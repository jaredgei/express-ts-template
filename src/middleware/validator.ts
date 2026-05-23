import { NextFunction, Request, Response, RequestHandler } from 'express';
import { validationResult } from 'express-validator';

export const checkValidation = (request: Request, response: Response, next: NextFunction) => {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
    return response.status(400).json({ errors: errors.array()[0].msg });
  }
  next();
};

export default (rules: RequestHandler | RequestHandler[]): RequestHandler[] => {
  return Array.isArray(rules) ? [...rules, checkValidation] : [rules, checkValidation];
};
