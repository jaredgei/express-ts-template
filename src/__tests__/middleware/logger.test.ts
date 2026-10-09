import crypto from 'crypto';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import logger from '@/middleware/logger';

const app = express()
  .use(logger)
  .post('/login', express.json(), (_req, res) => {
    res.sendStatus(204);
  });

describe('request logger', () => {
  let output: () => string;

  beforeEach(() => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    output = () => log.mock.calls.flat().join('\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the path but never bodies or query strings', async () => {
    const password = `secret-${crypto.randomUUID()}`;
    await request(app).post('/login?token=leaky-query').send({ password });

    expect(output()).toContain('"path":"/login"');
    expect(output()).not.toContain(password);
    expect(output()).not.toContain('leaky-query');
  });

  it('echoes a valid x-request-id and replaces a malformed one', async () => {
    const valid = await request(app).post('/login').set('x-request-id', 'abc-123');
    expect(valid.headers['x-request-id']).toBe('abc-123');

    const malformed = await request(app).post('/login').set('x-request-id', 'has spaces!');
    expect(malformed.headers['x-request-id']).not.toBe('has spaces!');
    expect(malformed.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });
});
