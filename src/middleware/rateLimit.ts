import { ipKeyGenerator, MemoryStore, Options, rateLimit } from 'express-rate-limit';

const base: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { errors: [{ message: 'Too many attempts, please try again later' }] },
};

export const registerRateLimitStore = new MemoryStore();
export const loginRateLimitStore = new MemoryStore();

export const registerRateLimiter = rateLimit({ ...base, store: registerRateLimitStore });

export const loginRateLimiter = rateLimit({
  ...base,
  store: loginRateLimitStore,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''}`,
});
