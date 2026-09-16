import { Router } from 'express';

import { MountedRouter, toOpenApiPaths } from '@/utils/route';

export const serveSwaggerDocs = async (router: Router, mounted: MountedRouter[]) => {
  const swaggerUi = await import('swagger-ui-express');
  const { OpenAPIRegistry, OpenApiGeneratorV3 } = await import('@asteasolutions/zod-to-openapi');

  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'cookieAuth', { type: 'apiKey', in: 'cookie', name: 'sid' });
  for (const { prefix, router } of mounted) {
    for (const path of toOpenApiPaths(prefix, router.routes)) registry.registerPath(path);
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: { title: 'Express TS API Docs', version: '1.0.0', description: 'Automatically generated API documentation.' },
    servers: [{ url: '/', description: 'Current host' }],
  });

  router.use('/docs', swaggerUi.default.serve, swaggerUi.default.setup(document));
};
