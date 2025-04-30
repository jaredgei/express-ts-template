import { Request, Response } from 'express-serve-static-core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { exit } from 'process';

import logger from './middleware/logger';
import exampleRouter from './routes/example';

(async () => {
  try {
    // INIT
    const app = express();

    // MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());
    app.use(logger);

    // API ROUTES
    app.use('/api/example', exampleRouter);

    app.use('/', (_: Request, response: Response) => response.send('Hello World!'));

    // UI
    // if (!process.env.FRONTEND_DIR) throw new Error('FRONTEND_DIR is not defined');
    // app.use(express.static(process.env.FRONTEND_DIR));
    // app.get('/*', (_: Request, response: Response) => {
    //   response.sendFile(path.join(process.env.FRONTEND_DIR!, 'index.html'));
    // });

    // START
    await app.listen(process.env.PORT || 8001, () => console.log(`Server is listening on port ${process.env.PORT || 8001}`));
  } catch (error) {
    console.error(error);
    exit(1);
  }
})();
