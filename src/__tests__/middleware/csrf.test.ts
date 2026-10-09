import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { verifyOrigin } from '@/middleware/csrf';
import { errorHandler } from '@/middleware/error';

const app = express()
  .use(verifyOrigin)
  .all('/', (_req, res) => {
    res.sendStatus(204);
  })
  .use(errorHandler);

describe('verifyOrigin', () => {
  it('blocks a state-changing request from a disallowed origin', async () => {
    const res = await request(app).post('/').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ errors: [{ message: 'Cross-origin request blocked' }] });
  });

  it('trusts Sec-Fetch-Site same-origin even when Origin does not match the proxied protocol', async () => {
    const res = await request(app).post('/').set('Origin', 'https://app.example').set('Sec-Fetch-Site', 'same-origin');
    expect(res.status).toBe(204);
  });

  it('still checks Origin when Sec-Fetch-Site is cross-site', async () => {
    const res = await request(app).post('/').set('Origin', 'https://evil.example').set('Sec-Fetch-Site', 'cross-site');
    expect(res.status).toBe(403);
  });

  it('allows a request whose Origin matches the host', async () => {
    const res = await request(app).post('/').set('Host', 'api.example').set('Origin', 'http://api.example');
    expect(res.status).toBe(204);
  });

  it('allows a safe GET regardless of origin', async () => {
    const res = await request(app).get('/').set('Origin', 'https://evil.example');
    expect(res.status).toBe(204);
  });
});
