import { Router } from 'express';
import { registeredPaths } from './route';

export const serveSwaggerDocs = async (router: Router) => {
  const swaggerUi = await import('swagger-ui-express');
  const { OpenAPIRegistry, OpenApiGeneratorV3 } = await import('@asteasolutions/zod-to-openapi');

  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  for (const path of registeredPaths) registry.registerPath(path);

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const swaggerDocument = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Express TS API Docs',
      version: '1.0.0',
      description: 'Automatically generated API documentation.',
    },
    servers: [
      {
        url: '/',
        description: 'Current host',
      },
    ],
  });

  router.use('/docs', swaggerUi.default.serve, swaggerUi.default.setup(swaggerDocument));
};
