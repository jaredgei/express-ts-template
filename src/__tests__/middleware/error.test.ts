import crypto from 'crypto';

import { sql } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '@/middleware/error';

import { client, db } from '@/utils/database';

afterAll(async () => {
  await client.end();
});

const appThrowing = (fail: () => Promise<unknown>) =>
  express()
    .get('/boom', async () => {
      await fail();
    })
    .use(errorHandler);

describe('errorHandler', () => {
  let output: () => string;

  beforeEach(() => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    output = () => [...log.mock.calls, ...error.mock.calls].flat().join('\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns a rejected async handler into a generic JSON 500 without leaking internals', async () => {
    const res = await request(
      appThrowing(async () => {
        throw new Error('secret database credentials leaked');
      }),
    ).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ errors: [{ message: 'Internal Server Error' }] });
    expect(JSON.stringify(res.body)).not.toContain('secret database credentials');
  });

  it('handles thrown non-Error values', async () => {
    const res = await request(
      appThrowing(async () => {
        throw null;
      }),
    ).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ errors: [{ message: 'Internal Server Error' }] });
  });

  it('logs failed queries without their bound parameters', async () => {
    const email = `${crypto.randomUUID()}@example.com`;
    const res = await request(appThrowing(() => db.execute(sql`SELECT ${email}::text, 1 / 0`))).get('/boom?token=leaky-query');

    expect(res.status).toBe(500);
    expect(output()).toContain('division by zero');
    expect(output()).toContain('error.test.ts');
    expect(output()).not.toContain(email);
    expect(output()).not.toContain('leaky-query');
  });
});
