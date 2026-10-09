import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import express, { Request, RequestHandler, Response } from 'express';
import { z, ZodObject, ZodRawShape, ZodType } from 'zod';

import { authenticate } from '@/middleware/auth';
import { errorResponseSchema } from '@/middleware/error';
import { validate } from '@/middleware/validator';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type RouteSpec = {
  summary?: string;
  description?: string;
  security?: boolean;
  params?: ZodObject<ZodRawShape>;
  query?: ZodObject<ZodRawShape>;
  body?: ZodType;
  response?: ZodType;
  status?: number;
  errors?: Readonly<Record<number, string>>;
  use?: readonly RequestHandler[];
};

type Parsed<T, Fallback> = T extends ZodType ? z.output<T> : Fallback;

type Unvalidated = Record<never, never>;

export type RouteRequest<S extends RouteSpec> = Request<
  Parsed<S['params'], Unvalidated>,
  unknown,
  Parsed<S['body'], unknown>,
  Parsed<S['query'], Unvalidated>
> &
  (S['security'] extends true ? { userId: string } : unknown);

type ResponseBody<S extends RouteSpec> = S['response'] extends ZodType ? z.input<S['response']> : void;

export type RouteHandler<S extends RouteSpec> = (req: RouteRequest<S>, res: Response) => ResponseBody<S> | Promise<ResponseBody<S>>;

const INPUTS = ['params', 'query', 'body'] as const;

const successStatus = (spec: RouteSpec) => spec.status ?? (spec.response ? 200 : 204);

const middleware = (spec: RouteSpec): RequestHandler[] => [
  ...(spec.security ? [authenticate] : []),
  ...INPUTS.flatMap((key) => {
    const schema = spec[key];
    return schema ? [validate(key, schema)] : [];
  }),
  ...(spec.use ?? []),
];

const respond =
  <S extends RouteSpec>(spec: S, handler: RouteHandler<S>): RequestHandler =>
  async (req, res) => {
    const body = await handler(req as RouteRequest<S>, res);
    if (res.headersSent) return;
    res.status(successStatus(spec));
    if (spec.response) res.json(spec.response.parse(body));
    else res.end();
  };

const jsonContent = (schema: ZodType) => ({ 'application/json': { schema } });

const errorResponses = (spec: RouteSpec) => {
  const errors: Record<number, string> = {};
  if (INPUTS.some((key) => spec[key])) errors[400] = 'Invalid input';
  if (spec.security) errors[401] = 'Not authenticated';
  return { ...errors, ...spec.errors };
};

const toOpenApi = (method: HttpMethod, path: string, spec: RouteSpec): RouteConfig => ({
  method,
  path,
  summary: spec.summary ?? `${method.toUpperCase()} ${path}`,
  description: spec.description,
  security: spec.security ? [{ cookieAuth: [] }] : undefined,
  request: { params: spec.params, query: spec.query, body: spec.body && { content: jsonContent(spec.body) } },
  responses: {
    [successStatus(spec)]: { description: 'Success', content: spec.response && jsonContent(spec.response) },
    ...Object.fromEntries(
      Object.entries(errorResponses(spec)).map(([status, description]) => [status, { description, content: jsonContent(errorResponseSchema) }]),
    ),
  },
});

const joinPath = (...segments: string[]) => `/${segments.join('/').split('/').filter(Boolean).join('/')}`;

const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export const createRouter = (prefix: string) => {
  const router = express.Router().use(noStore);
  const routes: RouteConfig[] = [];

  const on =
    (method: HttpMethod) =>
    <const S extends RouteSpec>(path: string, spec: S, handler: RouteHandler<S>) => {
      routes.push(toOpenApi(method, joinPath(prefix, path).replace(/:(\w+)/g, '{$1}'), spec));
      router[method](path, ...middleware(spec), respond(spec, handler));
    };

  return { prefix, router, routes, get: on('get'), post: on('post'), put: on('put'), patch: on('patch'), delete: on('delete') };
};

export type AppRouter = ReturnType<typeof createRouter>;
