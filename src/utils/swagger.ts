import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './route';

export const serveSwaggerDocs = (router: Router) => {
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

  router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
