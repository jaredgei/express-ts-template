import path from 'path';

import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

import logger from './middleware/logger';
import userRouter from './routes/user';
import { mountRouter } from './utils/route';

export const createApp = async () => {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(logger);

  mountRouter(app, '/api/users', userRouter);

  if (process.env.NODE_ENV !== 'production') {
    const { serveSwaggerDocs } = await import('./utils/swagger');
    await serveSwaggerDocs(app);
    console.log('Swagger documentation available at /docs');
  }

  if (process.env.FRONTEND_DIR) {
    const frontendDir = path.resolve(process.env.FRONTEND_DIR);
    app.use(express.static(frontendDir));
    app.use((_req: Request, res: Response) => res.sendFile(path.join(frontendDir, 'index.html')));
  }

  app.use((error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
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
  });

  return app;
};
