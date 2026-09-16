import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import express, { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import { z, ZodObject, ZodRawShape } from 'zod';

import { validateBody, validateParams, validateQuery } from '@/middleware/validator';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

type ObjectSchema = ZodObject<ZodRawShape>;

type ResponseSpec = { description?: string; schema?: ObjectSchema };

export const errorResponseSchema = z.object({ errors: z.array(z.string()) });

export type RouteShorthand = {
  body?: ObjectSchema;
  query?: ObjectSchema;
  params?: ObjectSchema;
  response?: ObjectSchema;
  status?: number;
  responses?: Record<number, ResponseSpec>;
  summary?: string;
  description?: string;
  security?: boolean;
};

type InferParams<T> = T extends ObjectSchema ? z.infer<T> & ParamsDictionary : ParamsDictionary;
type InferQuery<T> = T extends ObjectSchema ? z.infer<T> & Query : Query;
type InferBody<T> = T extends ObjectSchema ? z.infer<T> : unknown;

type TypedRequest<S extends RouteShorthand> = Request<InferParams<S['params']>, unknown, InferBody<S['body']>, InferQuery<S['query']>>;

type RouteHandler<S extends RouteShorthand> = (req: TypedRequest<S>, res: Response, next: NextFunction) => unknown;

export type RouteDefinition = {
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  request: { body?: ObjectSchema; query?: ObjectSchema; params?: ObjectSchema };
  responses: Record<number, ResponseSpec>;
  security?: boolean;
};

type RouteMethod = <S extends RouteShorthand>(path: string, schema: S, ...handlers: (RouteHandler<S> | RequestHandler)[]) => CustomRouter;

export type CustomRouter = {
  expressRouter: Router;
  routes: RouteDefinition[];
} & Record<HttpMethod, RouteMethod>;

export type MountedRouter = { prefix: string; router: CustomRouter };

export const createRouter = (): CustomRouter => {
  const expressRouter = express.Router();
  const routes: RouteDefinition[] = [];

  const addRoute = <S extends RouteShorthand>(method: HttpMethod, path: string, schema: S, handlers: (RouteHandler<S> | RequestHandler)[]) => {
    routes.push({
      method,
      path,
      summary: schema.summary ?? `${method.toUpperCase()} ${path}`,
      description: schema.description,
      request: { body: schema.body, query: schema.query, params: schema.params },
      responses: schema.responses ?? { [schema.status ?? 200]: { schema: schema.response } },
      security: schema.security,
    });

    const middlewares: RequestHandler[] = [];
    if (schema.body) middlewares.push(validateBody(schema.body));
    if (schema.query) middlewares.push(validateQuery(schema.query));
    if (schema.params) middlewares.push(validateParams(schema.params));

    expressRouter[method](path, ...middlewares, ...(handlers as RequestHandler[]));
    return self;
  };

  const on =
    (method: HttpMethod): RouteMethod =>
    (path, schema, ...handlers) =>
      addRoute(method, path, schema, handlers);

  const self: CustomRouter = {
    expressRouter,
    routes,
    get: on('get'),
    post: on('post'),
    put: on('put'),
    delete: on('delete'),
    patch: on('patch'),
  };

  return self;
};

const joinPath = (prefix: string, path: string) => `/${[prefix, path].join('/').split('/').filter(Boolean).join('/')}`;

export const toOpenApiPaths = (prefix: string, routes: RouteDefinition[]): RouteConfig[] =>
  routes.map((route) => {
    const request: RouteConfig['request'] = {};
    if (route.request.body) request.body = { content: { 'application/json': { schema: route.request.body } } };
    if (route.request.query) request.query = route.request.query;
    if (route.request.params) request.params = route.request.params;

    const responses: RouteConfig['responses'] = {};
    for (const [status, spec] of Object.entries(route.responses)) {
      responses[Number(status)] = {
        description: spec.description ?? 'Success',
        content: spec.schema ? { 'application/json': { schema: spec.schema } } : undefined,
      };
    }

    return {
      method: route.method,
      path: joinPath(prefix, route.path).replace(/:([^/]+)/g, '{$1}'),
      summary: route.summary,
      description: route.description,
      request,
      responses,
      security: route.security ? [{ cookieAuth: [] }] : undefined,
    };
  });
