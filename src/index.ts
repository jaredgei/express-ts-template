import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { exit } from 'process';

import logger from './middleware/logger';
import userRouter from './routes/user';
import { testConnection } from './utils/database';
import { mountRouter } from './utils/route';
import { serveSwaggerDocs } from './utils/swagger';

(async () => {
  try {
    // INIT
    await testConnection();
    const app = express();

    // MIDDLEWARE & LOGGING
    app.use(express.json());
    app.use(cookieParser());
    app.use(logger);

    // SECURITY HEADERS
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.removeHeader('X-Powered-By');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // API ROUTES
    mountRouter(app, '/api/users', userRouter);

    // SWAGGER DOCS (Only in Non-Production Environments)
    if (process.env.NODE_ENV !== 'production') {
      serveSwaggerDocs(app);
      console.log('Swagger documentation available at /docs');
    }

    app.use('/', (_: Request, response: Response) => response.send('Hello World!'));

    // GLOBAL ERROR HANDLER (Ensures JSON responses instead of default Express HTML error pages)
    app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Global Error Caught:', error);
      res.status(error.status || 500).json({
        errors: error.message || 'Internal Server Error',
      });
    });

    // START
    app.listen(process.env.PORT || 8001, () => console.log(`Server is listening on port ${process.env.PORT || 8001}`));
  } catch (error) {
    console.error(error);
    exit(1);
  }
})();
