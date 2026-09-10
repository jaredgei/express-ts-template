import { Request, Response, NextFunction } from 'express';

import { SESSION_COOKIE, getSessionUserId } from '../utils/session';

export type AuthenticatedRequest = Request & { userId: string };

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const userId = token ? await getSessionUserId(token) : null;
  if (!userId) return res.status(401).json({ errors: 'Unauthorized' });

  (req as AuthenticatedRequest).userId = userId;
  next();
};
