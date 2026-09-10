import { rateLimit } from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { errors: 'Too many attempts, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});
