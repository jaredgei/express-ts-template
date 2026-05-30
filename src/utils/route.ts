import express, { Router, RequestHandler } from 'express';
import { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validator';

export const registry = new OpenAPIRegistry();

interface RouteDefinition {
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
}

export interface RouteShorthand {
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodObject<z.ZodRawShape>;
  params?: z.ZodObject<z.ZodRawShape>;
  response?: z.ZodObject<z.ZodRawShape>;
  summary?: string;
  description?: string;
}

export class CustomRouter {
  public expressRouter = Router();
  public routes: RouteDefinition[] = [];

  private addRoute(method: RouteDefinition['method'], path: string, schema: RouteShorthand, handler: RequestHandler | RequestHandler[]) {
    this.routes.push({
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
      handler,
    });

    const middlewares: RequestHandler[] = [];
    if (schema.body) middlewares.push(validateBody(schema.body));
    if (schema.query) middlewares.push(validateQuery(schema.query));
    if (schema.params) middlewares.push(validateParams(schema.params));

    const expressPath = path.replace(/{([^}]+)}/g, ':$1');
    const handlers = Array.isArray(handler) ? handler : [handler];
    this.expressRouter[method](expressPath, ...middlewares, ...handlers);
  }

  public get(path: string, schema: RouteShorthand, handler: RequestHandler | RequestHandler[]) {
    this.addRoute('get', path, schema, handler);
  }

  public post(path: string, schema: RouteShorthand, handler: RequestHandler | RequestHandler[]) {
    this.addRoute('post', path, schema, handler);
  }

  public put(path: string, schema: RouteShorthand, handler: RequestHandler | RequestHandler[]) {
    this.addRoute('put', path, schema, handler);
  }

  public delete(path: string, schema: RouteShorthand, handler: RequestHandler | RequestHandler[]) {
    this.addRoute('delete', path, schema, handler);
  }

  public patch(path: string, schema: RouteShorthand, handler: RequestHandler | RequestHandler[]) {
    this.addRoute('patch', path, schema, handler);
  }
}

export const createRouter = () => new CustomRouter();

export const mountRouter = (app: express.IRouter, prefix: string, customRouter: CustomRouter) => {
  app.use(prefix, customRouter.expressRouter);

  for (const route of customRouter.routes) {
    const { method, path, request, responses, summary, description } = route;
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

    registry.registerPath({
      method,
      path: combinedPath,
      summary,
      description,
      request: openApiRequest,
      responses: openApiResponses,
    });
  }
};
