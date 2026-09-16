import crypto from 'crypto';

import { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

export const logJson = (fields: Record<string, unknown>, error = false) =>
  (error ? console.error : console.log)(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));

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
