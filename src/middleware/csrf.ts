import { NextFunction, Request, Response } from 'express';

import { HttpError } from '@/middleware/error';

import { env } from '@/utils/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const allowedOrigin = (req: Request, origin: string) => {
  if (env.CORS_ORIGIN.includes(origin)) return true;
  const host = req.get('host');
  return host ? origin === `${req.protocol}://${host}` : false;
};

export const verifyOrigin = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method) || req.get('sec-fetch-site') === 'same-origin') return next();

  const origin = req.get('origin');
  if (origin && !allowedOrigin(req, origin)) throw new HttpError(403, 'Cross-origin request blocked');
  next();
};
