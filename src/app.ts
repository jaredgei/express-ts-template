import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import logger from './middleware/logger';
import security from './middleware/security';
import userRouter from './routes/user';
import { mountRouter } from './utils/route';

export const createApp = async () => {
  const app = express();

  // MIDDLEWARE
  app.use(express.json());
  app.use(cookieParser());
  app.use(logger);
  app.use(security);

  // API ROUTES
  mountRouter(app, '/api/users', userRouter);

  // SWAGGER DOCS (Only in Non-Production Environments)
  if (process.env.NODE_ENV !== 'production') {
    const { serveSwaggerDocs } = await import('./utils/swagger');
    await serveSwaggerDocs(app);
    console.log('Swagger documentation available at /docs');
  }

  app.use('/', (_: Request, response: Response) => response.send('Hello World!'));

  // GLOBAL ERROR HANDLER (Ensures JSON responses instead of default Express HTML error pages)
  app.use((error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
    const status = error.status || 500;

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ip: req.ip,
        method: req.method,
        url: req.originalUrl || req.url,
        status,
        error: error.message || 'Internal Server Error',
        stack: error.stack,
      }),
    );

    res.status(status).json({
      errors: error.message || 'Internal Server Error',
    });
  });

  return app;
};
