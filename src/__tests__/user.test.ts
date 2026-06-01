import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { db, client } from '../utils/database';
import { users } from '../models/user';

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

describe('POST /api/users/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await request(app).post('/api/users/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: testUser.name, email: testUser.email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toBeDefined();
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

  it('authenticates with valid credentials', async () => {
    const res = await request(app).post('/api/users/login').send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('rejects invalid password', async () => {
    const res = await request(app).post('/api/users/login').send({ email: testUser.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app).post('/api/users/login').send({ email: 'nobody@example.com', password: 'pass' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/me', () => {
  it('returns the authenticated user profile', async () => {
    const {
      body: { accessToken },
    } = await request(app).post('/api/users/register').send(testUser);
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('Token refresh flow', () => {
  it('issues a new access token from refresh cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);
    const res = await agent.post('/api/users/refresh');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('clears refresh cookie on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/users/register').send(testUser);
    const logoutRes = await agent.post('/api/users/logout');
    expect(logoutRes.status).toBe(200);

    const refreshRes = await agent.post('/api/users/refresh');
    expect(refreshRes.status).toBe(401);
  });
});
