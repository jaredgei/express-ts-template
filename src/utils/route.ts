import express, { Router, RequestHandler } from 'express';
import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams, validateResponse } from '../middleware/validator';

export const registeredPaths: RouteConfig[] = [];

type RouteDefinition = {
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  path: string;
  summary?: string;
  description?: string;
  request?: {
    body?: z.ZodObject<z.ZodRawShape>;
    query?: z.ZodObject<z.ZodRawShape>;
    params?: z.ZodObject<z.ZodRawShape>;
  };
  responses: Record<number, { description: string; schema?: z.ZodObject<z.ZodRawShape> }>;
  handler: RequestHandler | RequestHandler[];
  security?: boolean;
};

export type RouteShorthand = {
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodObject<z.ZodRawShape>;
  params?: z.ZodObject<z.ZodRawShape>;
  response?: z.ZodObject<z.ZodRawShape>;
  summary?: string;
  description?: string;
  security?: boolean;
};

export type CustomRouter = {
  expressRouter: Router;
  routes: RouteDefinition[];
  get: (path: string, schema: RouteShorthand, ...handlers: RequestHandler[]) => CustomRouter;
  post: (path: string, schema: RouteShorthand, ...handlers: RequestHandler[]) => CustomRouter;
  put: (path: string, schema: RouteShorthand, ...handlers: RequestHandler[]) => CustomRouter;
  delete: (path: string, schema: RouteShorthand, ...handlers: RequestHandler[]) => CustomRouter;
  patch: (path: string, schema: RouteShorthand, ...handlers: RequestHandler[]) => CustomRouter;
};

export const createRouter = (): CustomRouter => {
  const expressRouter = express.Router();
  const routes: RouteDefinition[] = [];

  const self: CustomRouter = {
    expressRouter,
    routes,
    get(path, schema, ...handlers) {
      return addRoute('get', path, schema, handlers);
    },
    post(path, schema, ...handlers) {
      return addRoute('post', path, schema, handlers);
    },
    put(path, schema, ...handlers) {
      return addRoute('put', path, schema, handlers);
    },
    delete(path, schema, ...handlers) {
      return addRoute('delete', path, schema, handlers);
    },
    patch(path, schema, ...handlers) {
      return addRoute('patch', path, schema, handlers);
    },
  };

  function addRoute(method: RouteDefinition['method'], path: string, schema: RouteShorthand, handlers: RequestHandler[]) {
    routes.push({
      method,
      path,
      summary: schema.summary || `${method.toUpperCase()} ${path}`,
      description: schema.description,
      request: {
        body: schema.body,
        query: schema.query,
        params: schema.params,
      },
      responses: {
        200: {
          description: 'Success',
          schema: schema.response,
        },
      },
      security: schema.security,
      handler: handlers,
    });

    const middlewares: RequestHandler[] = [];
    if (schema.body) middlewares.push(validateBody(schema.body));
    if (schema.query) middlewares.push(validateQuery(schema.query));
    if (schema.params) middlewares.push(validateParams(schema.params));
    if (schema.response) middlewares.push(validateResponse(schema.response));

    const expressPath = path.replace(/{([^}]+)}/g, ':$1');
    expressRouter[method](expressPath, ...middlewares, ...handlers);

    return self;
  }

  return self;
};

export const mountRouter = (app: express.IRouter, prefix: string, customRouter: CustomRouter) => {
  app.use(prefix, customRouter.expressRouter);

  for (const route of customRouter.routes) {
    const { method, path, request, responses, summary, description, security } = route;
    const combinedPath = `${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/$/, '') || '/';

    const openApiRequest: RouteConfig['request'] = {};
    if (request?.body) openApiRequest.body = { content: { 'application/json': { schema: request.body } } };
    if (request?.query) openApiRequest.query = request.query;
    if (request?.params) openApiRequest.params = request.params;

    const openApiResponses: RouteConfig['responses'] = {};
    for (const [code, res] of Object.entries(responses)) {
      openApiResponses[Number(code)] = {
        description: res.description,
        content: res.schema ? { 'application/json': { schema: res.schema } } : undefined,
      };
    }

    registeredPaths.push({
      method,
      path: combinedPath,
      summary,
      description,
      request: openApiRequest,
      responses: openApiResponses,
      security: security ? [{ bearerAuth: [] }] : undefined,
    });
  }
};
