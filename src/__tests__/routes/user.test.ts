import crypto from 'crypto';

import { eq } from 'drizzle-orm';
import { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sessions } from '@/models/session';

import { rateLimitStores } from '@/middleware/rateLimit';

import { client, db } from '@/utils/database';

import { createApp } from '@/app';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

let testUser: { name: string; email: string; password: string };

beforeEach(async () => {
  testUser = { name: 'Test User', email: `${crypto.randomUUID()}@example.com`, password: 'password123' };
  await Promise.all(rateLimitStores.map((store) => store.resetAll()));
});

afterAll(async () => {
  await client.end();
});

const sessionCookie = (res: request.Response): string[] => [res.headers['set-cookie'] ?? []].flat();

describe('POST /api/users/register', () => {
  it('registers a new user, returns the user and sets a session cookie', async () => {
    const res = await request(app).post('/api/users/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: testUser.name, email: testUser.email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(sessionCookie(res)[0]).toMatch(/sid=/);
  });

  it('rejects duplicate emails, including concurrent ones, with 409', async () => {
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/users/register').send(testUser)));
    expect(results.map((res) => res.status).sort()).toEqual([201, 409, 409]);
  });

  it('normalizes the email by trimming and lowercasing', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...testUser, email: `  ${testUser.email.toUpperCase()}  ` });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('reports validation errors per field', async () => {
    const res = await request(app).post('/api/users/register').send({ email: testUser.email });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });
});

describe('POST /api/users/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/users/register').send(testUser);
  });

  it('authenticates with valid credentials and sets a session cookie', async () => {
    const res = await request(app).post('/api/users/login').send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
    expect(sessionCookie(res)[0]).toMatch(/sid=/);
  });

  it('matches the email case-insensitively', async () => {
    const res = await request(app).post('/api/users/login').send({ email: testUser.email.toUpperCase(), password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('rejects invalid password', async () => {
    const res = await request(app).post('/api/users/login').send({ email: testUser.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: `${crypto.randomUUID()}@example.com`, password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('revokes the previous session on re-login', async () => {
    const previousCookie = sessionCookie(await request(app).post('/api/users/login').send(testUser));
    await request(app).post('/api/users/login').set('Cookie', previousCookie).send(testUser);

    expect((await request(app).get('/api/users/me').set('Cookie', previousCookie)).status).toBe(401);
  });

  it('rejects an oversized password before hashing', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ email: testUser.email, password: 'x'.repeat(257) });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ field: 'password' })]);
  });

  it('rate limits repeated attempts against one account', async () => {
    const attempt = (email: string) => request(app).post('/api/users/login').send({ email, password: 'wrong' });
    for (let n = 0; n < 9; n++) await attempt(testUser.email);
    expect((await attempt(testUser.email)).status).toBe(401);
    const limited = await attempt(testUser.email.toUpperCase());
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ errors: [{ message: 'Too many attempts, please try again later' }] });
    expect((await attempt(`${crypto.randomUUID()}@example.com`)).status).toBe(401);
  });

  it('does not count successful logins toward the limit', async () => {
    for (let n = 0; n < 11; n++) expect((await request(app).post('/api/users/login').send(testUser)).status).toBe(200);
  });

  it('rate limits one client spraying many accounts', async () => {
    const attempt = () =>
      request(app)
        .post('/api/users/login')
        .send({ email: `${crypto.randomUUID()}@example.com`, password: 'wrong' });
    for (let n = 0; n < 50; n++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });
});

describe('GET /api/users/me', () => {
  it('returns the authenticated user profile via the session cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);
    const res = await agent.get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('reissues the session cookie once the session slides', async () => {
    const agent = request.agent(app);
    const { body } = await agent.post('/api/users/register').send(testUser);
    expect(sessionCookie(await agent.get('/api/users/me'))).toEqual([]);

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 60_000) })
      .where(eq(sessions.userId, body.user.id));

    expect(sessionCookie(await agent.get('/api/users/me'))[0]).toMatch(/sid=/);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('rejects a JSON-encoded session cookie without erroring', async () => {
    const res = await request(app).get('/api/users/me').set('Cookie', 'sid=j:{"a":1}');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/logout', () => {
  it('destroys the session so the cookie no longer authenticates', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);

    expect((await agent.get('/api/users/me')).status).toBe(200);

    const logoutRes = await agent.post('/api/users/logout');
    expect(logoutRes.status).toBe(204);
    expect(sessionCookie(logoutRes)[0]).toMatch(/sid=;/);

    expect((await agent.get('/api/users/me')).status).toBe(401);
  });
});

describe('GET /api/users/me/sessions', () => {
  it("lists only the caller's active sessions without secrets", async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);
    await request(app).post('/api/users/login').send(testUser);
    await request(app)
      .post('/api/users/register')
      .send({ ...testUser, email: `${crypto.randomUUID()}@example.com` });

    const res = await agent.get('/api/users/me/sessions?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.sessions[0]).toEqual({
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it('marks responses as uncacheable', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);
    expect((await agent.get('/api/users/me/sessions')).headers['cache-control']).toBe('no-store');
  });

  it('rejects an invalid limit', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);
    const res = await agent.get('/api/users/me/sessions?limit=999');
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ field: 'limit' })]);
  });

  it('rejects unauthenticated requests', async () => {
    expect((await request(app).get('/api/users/me/sessions')).status).toBe(401);
  });
});
