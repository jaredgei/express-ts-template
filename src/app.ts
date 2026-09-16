import path from 'path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import userRouter from '@/routes/user';

import logger, { logJson } from '@/middleware/logger';

import { client } from '@/utils/database';
import { env, isProduction } from '@/utils/env';
import { MountedRouter } from '@/utils/route';

export const errorHandler = (error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  const status = error.status ?? 500;

  logJson(
    {
      requestId: req.id,
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      status,
      error: error.message,
      stack: error.stack,
    },
    true,
  );

  res.status(status).json({ errors: [status < 500 ? error.message : 'Internal Server Error'] });
};

export const createApp = async () => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.length ? env.CORS_ORIGIN : false, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(logger);

  app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      await client`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  const mounted: MountedRouter[] = [{ prefix: '/api/users', router: userRouter }];
  for (const { prefix, router } of mounted) app.use(prefix, router.expressRouter);

  if (!isProduction) {
    const { serveSwaggerDocs } = await import('@/utils/swagger');
    await serveSwaggerDocs(app, mounted);
    console.log('Swagger documentation available at /docs');
  }

  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ errors: ['Not found'] }));

  if (env.FRONTEND_DIR) {
    const frontendDir = path.resolve(env.FRONTEND_DIR);
    app.use(express.static(frontendDir));
    app.use((_req: Request, res: Response) => res.sendFile(path.join(frontendDir, 'index.html')));
  }

  app.use(errorHandler);

  return app;
};
