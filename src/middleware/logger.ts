import crypto from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { logJson, requestFields } from '@/utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

const REQUEST_ID_PATTERN = /^[\w-]{1,128}$/;

export default (req: Request, res: Response, next: NextFunction) => {
  const provided = req.get('x-request-id');
  req.id = provided && REQUEST_ID_PATTERN.test(provided) ? provided : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  const start = performance.now();

  res.on('finish', () => {
    logJson({
      ...requestFields(req),
      ip: req.ip,
      status: res.statusCode,
      elapsedMs: parseFloat((performance.now() - start).toFixed(3)),
    });
  });

  next();
};
