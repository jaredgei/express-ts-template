import { Request, Response, NextFunction } from 'express';
import { z, ZodRawShape, ZodError } from 'zod';

const validateType = (key: 'body' | 'query' | 'params', schema: z.ZodObject<ZodRawShape>) => (req: Request, res: Response, next: NextFunction) => {
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

export const validateBody = (schema: z.ZodObject<ZodRawShape>) => validateType('body', schema);
export const validateQuery = (schema: z.ZodObject<ZodRawShape>) => validateType('query', schema);
export const validateParams = (schema: z.ZodObject<ZodRawShape>) => validateType('params', schema);
