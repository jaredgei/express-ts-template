import { Request, Response, NextFunction } from 'express';
import { verifyJwt, TokenPayload } from '../utils/auth';

export type AuthenticatedRequest = Request & {
  user?: TokenPayload;
};

/**
 * Express middleware to enforce JWT Bearer authentication.
 */
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ errors: 'Unauthorized: Missing or invalid token format' });
  const token = authHeader.split(' ')[1];
  const payload = verifyJwt(token, false);
  if (!payload) return res.status(401).json({ errors: 'Unauthorized: Token is invalid or has expired' });

  req.user = payload;
  next();
};
