import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';

import { createApp, errorHandler } from '../../app';
import { db, client } from '../../utils/database';
import { users } from '../../models/user';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

beforeEach(async () => {
  await db.delete(users);
});

afterAll(async () => {
  await client.end();
});

const testUser = { name: 'Test User', email: 'test@example.com', password: 'password123' };

const sessionCookie = (res: request.Response) => res.headers['set-cookie'];

describe('POST /api/users/register', () => {
  it('registers a new user, returns the user and sets a session cookie', async () => {
    const res = await request(app).post('/api/users/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: testUser.name, email: testUser.email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('accessToken');
    expect(sessionCookie(res)?.[0]).toMatch(/sid=/);
  });

  it('rejects duplicate emails', async () => {
    await request(app).post('/api/users/register').send(testUser);
    const res = await request(app)
      .post('/api/users/register')
      .send({ ...testUser, name: 'Other' });
    expect(res.status).toBe(400);
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/users/register').send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
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
    const res = await request(app).post('/api/users/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
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

describe('Global error handler', () => {
  it('forwards a rejected async handler as a generic JSON 500 without leaking internals', async () => {
    const failing = express();
    failing.get('/boom', async () => {
      throw new Error('secret database credentials leaked');
    });
    failing.use(errorHandler);

    const res = await request(failing).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ errors: 'Internal Server Error' });
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toContain('secret database credentials');
  });
});

describe('Auth rate limiter', () => {
  it('blocks requests once the limit is exceeded', async () => {
    const limited = express();
    limited.post('/try', rateLimit({ windowMs: 60_000, limit: 1, legacyHeaders: false }), (_req, res) => res.status(200).json({ ok: true }));

    const agent = request.agent(limited);
    expect((await agent.post('/try')).status).toBe(200);
    expect((await agent.post('/try')).status).toBe(429);
  });
});
