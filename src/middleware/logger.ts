import crypto from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { logJson } from '@/utils/logger';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export default (req: Request, res: Response, next: NextFunction) => {
  req.id = req.get('x-request-id') ?? crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  const start = performance.now();

  res.on('finish', () => {
    logJson({
      requestId: req.id,
      ip: req.ip,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      elapsedMs: parseFloat((performance.now() - start).toFixed(3)),
    });
  });

  next();
};
