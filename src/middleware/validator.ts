import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

import { ErrorDetail, ValidationError } from '@/middleware/error';

const formatZodError = (error: ZodError): ErrorDetail[] =>
  error.issues.map(({ message, path }) => (path.length ? { message, field: path.join('.') } : { message }));

export const validate = (key: 'body' | 'query' | 'params', schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req[key]);
  if (!result.success) throw new ValidationError(formatZodError(result.error));

  if (key === 'body') req.body = result.data;
  // Express 5 exposes req.query/req.params as read-only getters; defineProperty is the only way to replace them.
  else Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
  next();
};
