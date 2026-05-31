import { Router } from 'express';
import { registry } from './route';

export const serveSwaggerDocs = async (router: Router) => {
  // Lazy imports so swagger doesn't need to be required as a production dependency
  const swaggerUi = await import('swagger-ui-express');
  const { OpenApiGeneratorV3 } = await import('@asteasolutions/zod-to-openapi');

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
