import express, { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z, ZodRawShape } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validator';

export const registeredPaths: RouteConfig[] = [];

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

type RouteDefinition = {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  request?: { body?: z.ZodObject<ZodRawShape>; query?: z.ZodObject<ZodRawShape>; params?: z.ZodObject<ZodRawShape> };
  responses: { [statusCode: number]: { description: string; schema?: z.ZodObject<ZodRawShape> } };
  security?: boolean;
};

export type RouteShorthand = {
  query?: z.ZodObject<ZodRawShape>;
  body?: z.ZodObject<ZodRawShape>;
  params?: z.ZodObject<ZodRawShape>;
  response?: z.ZodObject<ZodRawShape>;
  status?: number;
  summary?: string;
  description?: string;
  security?: boolean;
};

type RouteMethod = <TReq extends Request = Request>(
  path: string,
  schema: RouteShorthand,
  ...handlers: Array<(req: TReq, res: Response, next: NextFunction) => unknown>
) => CustomRouter;

export type CustomRouter = {
  expressRouter: Router;
  routes: RouteDefinition[];
} & Record<HttpMethod, RouteMethod>;

export const createRouter = (): CustomRouter => {
  const expressRouter = express.Router();
  const routes: RouteDefinition[] = [];

  function addRoute<TReq extends Request = Request>(
    method: HttpMethod,
    path: string,
    schema: RouteShorthand,
    handlers: Array<(req: TReq, res: Response, next: NextFunction) => unknown>,
  ) {
    const expressHandlers = handlers.map((h) => (req: Request, res: Response, next: NextFunction) => h(req as TReq, res, next));

    routes.push({
      method,
      path,
      summary: schema.summary || `${method.toUpperCase()} ${path}`,
      description: schema.description,
      request: { body: schema.body, query: schema.query, params: schema.params },
      responses: { [schema.status ?? 200]: { description: 'Success', schema: schema.response } },
      security: schema.security,
    });

    const middlewares: RequestHandler[] = [];
    if (schema.body) middlewares.push(validateBody(schema.body));
    if (schema.query) middlewares.push(validateQuery(schema.query));
    if (schema.params) middlewares.push(validateParams(schema.params));

    expressRouter[method](path, ...middlewares, ...expressHandlers);

    return self;
  }

  const self = {
    expressRouter,
    routes,
    get: (path: string, schema: RouteShorthand, ...handlers: Parameters<RouteMethod>[2][]) => addRoute('get', path, schema, handlers),
    post: (path: string, schema: RouteShorthand, ...handlers: Parameters<RouteMethod>[2][]) => addRoute('post', path, schema, handlers),
    put: (path: string, schema: RouteShorthand, ...handlers: Parameters<RouteMethod>[2][]) => addRoute('put', path, schema, handlers),
    delete: (path: string, schema: RouteShorthand, ...handlers: Parameters<RouteMethod>[2][]) => addRoute('delete', path, schema, handlers),
    patch: (path: string, schema: RouteShorthand, ...handlers: Parameters<RouteMethod>[2][]) => addRoute('patch', path, schema, handlers),
  } as CustomRouter;

  return self;
};

export const mountRouter = (app: express.IRouter, prefix: string, customRouter: CustomRouter) => {
  app.use(prefix, customRouter.expressRouter);

  for (const route of customRouter.routes) {
    const { method, path, request, responses, summary, description, security } = route;
    const combined = `${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/$/, '') || '/';
    const openApiPath = combined.replace(/:([^/]+)/g, '{$1}');

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
      path: openApiPath,
      summary,
      description,
      request: openApiRequest,
      responses: openApiResponses,
      security: security ? [{ bearerAuth: [] }] : undefined,
    });
  }
};
