import { MemoryStore, rateLimit } from 'express-rate-limit';

export const authRateLimitStore = new MemoryStore();

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: authRateLimitStore,
  message: { errors: [{ message: 'Too many attempts, please try again later' }] },
});
