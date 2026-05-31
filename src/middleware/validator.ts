import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

const validateType = (key: 'body' | 'query' | 'params', schema: z.ZodObject<z.ZodRawShape>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req[key]);
    if (key === 'body') {
      req.body = parsed;
    } else {
      Object.defineProperty(req, key, { value: parsed, writable: true, configurable: true, enumerable: true });
    }
    next();
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ errors: error.issues[0].message });
    next(error);
  }
};

export const validateBody = (schema: z.ZodObject<z.ZodRawShape>) => validateType('body', schema);
export const validateQuery = (schema: z.ZodObject<z.ZodRawShape>) => validateType('query', schema);
export const validateParams = (schema: z.ZodObject<z.ZodRawShape>) => validateType('params', schema);

/**
 * Express middleware to automatically intercept and sanitize the outgoing response JSON payload.
 * Runs the response body through the co-located response Zod schema.
 */
export const validateResponse = (schema: z.ZodObject<z.ZodRawShape>) => (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  res.json = function (body: unknown): Response {
    try {
      const parsed = schema.parse(body);
      return originalJson.call(this, parsed);
    } catch (error) {
      console.error('Response validation/sanitization failed:', error);
      return originalJson.call(this, body);
    }
  };
  next();
};
