import fs from 'fs';
import os from 'os';
import path from 'path';

import { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { client } from '@/utils/database';
import { env } from '@/utils/env';

import { createApp } from '@/app';

let app: Express;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await client.end();
});

describe('Health checks', () => {
  it('reports liveness without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('reports readiness when the database is reachable', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });
});

describe('Unknown API routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/api/users/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: [{ message: 'Not found' }] });
  });
});

describe('Malformed JSON', () => {
  it('returns a 400 in the standard error shape', async () => {
    const res = await request(app).post('/api/users/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ errors: [{ message: expect.any(String) }] });
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

  it('returns 404 for missing static assets instead of index.html', async () => {
    const res = await request(spa).get('/assets/missing.js');
    expect(res.status).toBe(404);
  });

  it('keeps unknown API routes as JSON 404s', async () => {
    const res = await request(spa).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: [{ message: 'Not found' }] });
  });
});
