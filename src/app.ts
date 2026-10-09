import path from 'path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';

import { mountedRouters } from '@/routes';

import { verifyOrigin } from '@/middleware/csrf';
import { errorHandler, HttpError } from '@/middleware/error';
import logger from '@/middleware/logger';

import { client } from '@/utils/database';
import { env, isProduction } from '@/utils/env';
import { lifecycle } from '@/utils/lifecycle';
import { logJson } from '@/utils/logger';

const notFound = () => {
  throw new HttpError(404, 'Not found');
};

export const createApp = async () => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(helmet());

  app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req: Request, res: Response) => {
    if (lifecycle.shuttingDown) return res.status(503).json({ status: 'shutting down' });
    try {
      await client`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use(logger);
  app.use(cors({ origin: env.CORS_ORIGIN.length ? env.CORS_ORIGIN : false, credentials: true }));
  app.use(verifyOrigin);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  for (const { prefix, router } of mountedRouters) app.use(prefix, router.expressRouter);
  app.use('/api', notFound);

  if (!isProduction) {
    const { serveSwaggerDocs } = await import('@/utils/swagger');
    await serveSwaggerDocs(app, mountedRouters);
    logJson({ message: 'Swagger documentation available at /docs' });
  }

  if (env.FRONTEND_DIR) {
    const frontendDir = path.resolve(env.FRONTEND_DIR);
    app.use(express.static(frontendDir));
    app.get('/{*splat}', (_req: Request, res: Response) => res.sendFile(path.join(frontendDir, 'index.html')));
  }

  app.use(notFound);

  app.use(errorHandler);

  return app;
};
