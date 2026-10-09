import { NextFunction, Request, Response } from 'express';

import { HttpError } from '@/middleware/error';

import { getSession, sessionToken, setSessionCookie } from '@/utils/session';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = sessionToken(req);
  const session = token ? await getSession(token) : null;
  if (!token || !session) throw new HttpError(401, 'Unauthorized');

  if (session.renewed) setSessionCookie(res, token);
  req.userId = session.userId;
  next();
};
