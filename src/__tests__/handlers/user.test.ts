import crypto from 'crypto';

import { eq } from 'drizzle-orm';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sessions } from '@/models/session';

import { errorHandler } from '@/middleware/error';
import { authRateLimitStore } from '@/middleware/rateLimit';

import { client, db } from '@/utils/database';

import { createApp } from '@/app';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

let testUser: { name: string; email: string; password: string };

beforeEach(async () => {
  testUser = { name: 'Test User', email: `${crypto.randomUUID()}@example.com`, password: 'password123' };
  await authRateLimitStore.resetAll();
});

afterAll(async () => {
  await client.end();
});

const sessionCookie = (res: request.Response) => res.headers['set-cookie'];

describe('GET /health', () => {
  it('reports ok without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/users/register', () => {
  it('registers a new user, returns the user and sets a session cookie', async () => {
    const res = await request(app).post('/api/users/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: testUser.name, email: testUser.email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(sessionCookie(res)?.[0]).toMatch(/sid=/);
  });

  it('rejects duplicate emails, including concurrent ones, with 409', async () => {
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/users/register').send(testUser)));
    expect(results.map((res) => res.status).sort()).toEqual([201, 409, 409]);
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
    expect(sessionCookie(res)?.[0]).toMatch(/sid=/);
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
    const [previousCookie] = sessionCookie(await request(app).post('/api/users/login').send(testUser));
    await request(app).post('/api/users/login').set('Cookie', previousCookie).send(testUser);

    expect((await request(app).get('/api/users/me').set('Cookie', previousCookie)).status).toBe(401);
  });

  it('rate limits repeated attempts', async () => {
    await authRateLimitStore.resetAll();
    const attempt = () => request(app).post('/api/users/login').send({ email: testUser.email, password: 'wrong' });
    for (let n = 0; n < 9; n++) await attempt();
    expect((await attempt()).status).toBe(401);
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
    expect(sessionCookie(await agent.get('/api/users/me'))).toBeUndefined();

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 60_000) })
      .where(eq(sessions.userId, body.user.id));

    expect(sessionCookie(await agent.get('/api/users/me'))?.[0]).toMatch(/sid=/);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/users/logout', () => {
  it('destroys the session so the cookie no longer authenticates', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);

    expect((await agent.get('/api/users/me')).status).toBe(200);

    const logoutRes = await agent.post('/api/users/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    expect((await agent.get('/api/users/me')).status).toBe(401);
  });
});

describe('GET /api/users', () => {
  it('paginates with limit and offset', async () => {
    for (const n of [1, 2, 3])
      await request(app)
        .post('/api/users/register')
        .send({ ...testUser, email: `${n}-${testUser.email}` });

    const res = await request(app).get('/api/users?limit=2&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).not.toHaveProperty('passwordHash');
  });

  it('rejects an invalid limit', async () => {
    const res = await request(app).get('/api/users?limit=999');
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ field: 'limit' })]);
  });
});

describe('Unknown API routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/api/users/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: [{ message: 'Not found' }] });
  });
});

describe('Global error handler', () => {
  it('forwards a rejected async handler as a generic JSON 500 without leaking internals', async () => {
    const failing = express();
    failing.get('/boom', async () => {
      throw new Error('secret database credentials leaked');
    });
    failing.use(errorHandler);

    const res = await request(failing).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ errors: [{ message: 'Internal Server Error' }] });
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toContain('secret database credentials');
  });
});
