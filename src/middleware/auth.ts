import { NextFunction, Request, Response } from 'express';

import { getSessionUserId, SESSION_COOKIE } from '@/utils/session';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const userId = token ? await getSessionUserId(token) : null;
  if (!userId) return res.status(401).json({ errors: ['Unauthorized'] });

  req.userId = userId;
  next();
};

export const requireUserId = (req: Request): string => {
  if (!req.userId) throw new Error('requireUserId called without authenticate middleware');
  return req.userId;
};
