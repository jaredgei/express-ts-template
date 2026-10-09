import { MemoryStore, Options, rateLimit } from 'express-rate-limit';

import { HttpError } from '@/middleware/error';

export const rateLimitStores: MemoryStore[] = [];

const createLimiter = (options: Partial<Options> = {}) => {
  const store = new MemoryStore();
  rateLimitStores.push(store);
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: () => {
      throw new HttpError(429, 'Too many attempts, please try again later');
    },
    store,
    ...options,
  });
};

export const registerRateLimiter = createLimiter();

export const loginIpRateLimiter = createLimiter({ limit: 50, skipSuccessfulRequests: true });

export const loginEmailRateLimiter = createLimiter({ keyGenerator: (req) => req.body.email, skipSuccessfulRequests: true });
