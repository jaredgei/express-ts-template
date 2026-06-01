import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { exit } from 'process';

import logger from './middleware/logger';
import security from './middleware/security';
import userRouter from './routes/user';
import { testConnection } from './utils/database';
import { mountRouter } from './utils/route';

const PORT = process.env.PORT || 8001;

(async () => {
  try {
    // INIT
    await testConnection();
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
    app.use((error: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Global Error Caught:', error);
      res.status(error.status || error.statusCode || 500).json({
        errors: error.message || 'Internal Server Error',
      });
    });

    // START
    app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
  } catch (error) {
    console.error(error);
    exit(1);
  }
})();
