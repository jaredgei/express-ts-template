import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorHandler } from '@/middleware/error';

import { createRouter } from '@/utils/route';

const router = createRouter('/api/items');

router.get(
  '/:id',
  {
    params: z.object({ id: z.coerce.number().int() }),
    query: z.object({ verbose: z.stringbool().default(false) }),
    response: z.object({ id: z.number(), verbose: z.boolean() }),
  },
  (req) => ({ id: req.params.id, verbose: req.query.verbose, secret: 'leak' }),
);

router.post('/', { body: z.object({ name: z.string() }), response: z.object({ name: z.string() }), status: 201 }, (req) => ({ name: req.body.name }));

router.delete('/:id', { summary: 'Delete an item', errors: { 404: 'Item not found' } }, () => {});

const app = express().use(express.json()).use(router.prefix, router.router).use(errorHandler);

describe('createRouter', () => {
  it('parses params and query into their schema types', async () => {
    const res = await request(app).get('/api/items/7?verbose=true');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7, verbose: true });
  });

  it('strips fields the response schema does not declare', async () => {
    const res = await request(app).get('/api/items/7');
    expect(res.body).not.toHaveProperty('secret');
  });

  it('rejects invalid input with per-field errors', async () => {
    const res = await request(app).get('/api/items/abc');
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ field: 'id' })]);
  });

  it('uses the declared status', async () => {
    const res = await request(app).post('/api/items').send({ name: 'widget' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ name: 'widget' });
  });

  it('responds 204 with no body when no response schema is declared', async () => {
    const res = await request(app).delete('/api/items/7');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('sets Cache-Control: no-store', async () => {
    const res = await request(app).get('/api/items/7');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('registers OpenAPI paths with the prefix, path params, and declared errors', () => {
    const [get, post, del] = router.routes;
    expect(get).toMatchObject({ method: 'get', path: '/api/items/{id}', summary: 'GET /api/items/{id}' });
    expect(Object.keys(get?.responses ?? {})).toEqual(['200', '400']);
    expect(Object.keys(post?.responses ?? {})).toEqual(['201', '400']);
    expect(del).toMatchObject({ summary: 'Delete an item', security: undefined });
    expect(Object.keys(del?.responses ?? {})).toEqual(['204', '404']);
  });
});
