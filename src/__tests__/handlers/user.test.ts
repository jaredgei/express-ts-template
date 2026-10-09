import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { eq, sql } from 'drizzle-orm';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessions } from '@/models/session';

import { errorHandler } from '@/middleware/error';
import { rateLimitStores } from '@/middleware/rateLimit';

import { client, db } from '@/utils/database';
import { env } from '@/utils/env';

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
    expect(sessionCookie(res)?.[0]).toMatch(/sid=/);
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
    const [previousCookie] = sessionCookie(await request(app).post('/api/users/login').send(testUser));
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
    expect((await attempt(testUser.email.toUpperCase())).status).toBe(429);
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

describe('Unknown API routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/api/users/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: [{ message: 'Not found' }] });
  });
});

describe('Frontend fallback', () => {
  let spa: Express;

  let frontendDir: string;

  beforeAll(async () => {
    frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-'));
    fs.writeFileSync(path.join(frontendDir, 'index.html'), '<h1>spa</h1>');
    env.FRONTEND_DIR = frontendDir;
    try {
      spa = await createApp();
    } finally {
      env.FRONTEND_DIR = undefined;
    }
  });

  afterAll(() => {
    fs.rmSync(frontendDir, { recursive: true });
  });

  it('serves index.html for client-side routes', async () => {
    const res = await request(spa).get('/settings/profile');
    expect(res.status).toBe(200);
    expect(res.text).toContain('spa');
  });

  it('keeps unknown API routes as JSON 404s', async () => {
    const res = await request(spa).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: [{ message: 'Not found' }] });
  });
});

describe('Request id', () => {
  it('echoes a valid x-request-id and rejects a malformed one', async () => {
    const valid = await request(app).get('/api/users/me').set('x-request-id', 'abc-123');
    expect(valid.headers['x-request-id']).toBe('abc-123');

    const malformed = await request(app).get('/api/users/me').set('x-request-id', 'has spaces!');
    expect(malformed.headers['x-request-id']).not.toBe('has spaces!');
    expect(malformed.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });
});

describe('Cross-origin protection', () => {
  it('blocks a state-changing request from a disallowed origin', async () => {
    const res = await request(app).post('/api/users/login').set('Origin', 'https://evil.example').send(testUser);
    expect(res.status).toBe(403);
  });

  it('trusts Sec-Fetch-Site same-origin even when Origin does not match the proxied protocol', async () => {
    const res = await request(app).post('/api/users/login').set('Origin', 'https://app.example').set('Sec-Fetch-Site', 'same-origin').send(testUser);
    expect(res.status).toBe(401);
  });

  it('still checks Origin when Sec-Fetch-Site is cross-site', async () => {
    const res = await request(app).post('/api/users/login').set('Origin', 'https://evil.example').set('Sec-Fetch-Site', 'cross-site').send(testUser);
    expect(res.status).toBe(403);
  });

  it('allows a safe GET regardless of origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
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

describe('Logging', () => {
  let output: () => string;

  beforeEach(() => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    output = () => [...log.mock.calls, ...error.mock.calls].flat().join('\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never logs credentials or query strings', async () => {
    const password = `secret-${crypto.randomUUID()}`;
    await request(app)
      .post('/api/users/register')
      .send({ ...testUser, password });
    await request(app).post('/api/users/login').send({ email: testUser.email, password });
    await request(app).post('/api/users/login?token=leaky-query').send({ email: testUser.email, password: 'wrong' });

    expect(output()).toContain('/api/users/login');
    expect(output()).not.toContain(password);
    expect(output()).not.toContain('leaky-query');
  });

  it('logs failed queries without their bound parameters', async () => {
    const failing = express();
    failing.get('/boom', async () => {
      await db.execute(sql`SELECT ${testUser.email}::text, 1 / 0`);
    });
    failing.use(errorHandler);

    expect((await request(failing).get('/boom')).status).toBe(500);
    expect(output()).toContain('division by zero');
    expect(output()).toContain('user.test.ts');
    expect(output()).not.toContain(testUser.email);
  });
});
