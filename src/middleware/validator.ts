import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodObject, ZodRawShape } from 'zod';

export const formatZodError = (error: ZodError): string[] => {
  const { formErrors, fieldErrors } = z.flattenError(error);
  return [
    ...formErrors,
    ...Object.values(fieldErrors)
      .flat()
      .filter((message) => typeof message === 'string'),
  ];
};

const validate = (key: 'body' | 'query' | 'params', schema: ZodObject<ZodRawShape>) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req[key]);
  if (!result.success) return res.status(400).json({ errors: formatZodError(result.error) });

  if (key === 'body') req.body = result.data;
  // Express 5 exposes req.query/req.params as read-only getters; defineProperty is the only way to replace them.
  else Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true });
  next();
};

export const validateBody = (schema: ZodObject<ZodRawShape>) => validate('body', schema);
export const validateQuery = (schema: ZodObject<ZodRawShape>) => validate('query', schema);
export const validateParams = (schema: ZodObject<ZodRawShape>) => validate('params', schema);
