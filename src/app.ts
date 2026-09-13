import path from 'path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

import logger from '@/middleware/logger';
import userRouter from '@/routes/user';
import { client } from '@/utils/database';
import { env, isProduction } from '@/utils/env';
import { mountRouter } from '@/utils/route';

export const errorHandler = (error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  const status = error.status || 500;

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      status,
      error: error.message,
      stack: error.stack,
    }),
  );

  res.status(status).json({ errors: status < 500 ? error.message : 'Internal Server Error' });
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

  mountRouter(app, '/api/users', userRouter);

  if (!isProduction) {
    const { serveSwaggerDocs } = await import('@/utils/swagger');
    await serveSwaggerDocs(app);
    console.log('Swagger documentation available at /docs');
  }

  if (env.FRONTEND_DIR) {
    const frontendDir = path.resolve(env.FRONTEND_DIR);
    app.use(express.static(frontendDir));
    app.use((_req: Request, res: Response) => res.sendFile(path.join(frontendDir, 'index.html')));
  }

  app.use(errorHandler);

  return app;
};
