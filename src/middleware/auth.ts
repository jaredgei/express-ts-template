import { NextFunction, Request, Response } from 'express';

import { HttpError } from '@/middleware/error';

import { getSession, SESSION_COOKIE, sessionCookieOptions } from '@/utils/session';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? await getSession(token) : null;
  if (!session) throw new HttpError(401, 'Unauthorized');

  if (session.renewed) res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
  req.userId = session.userId;
  next();
};
