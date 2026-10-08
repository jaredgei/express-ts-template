import { DrizzleQueryError } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import postgres from 'postgres';

import { logJson } from '@/utils/logger';

const UNIQUE_VIOLATION = '23505';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type ExpressError = Error & { status?: number; expose?: boolean };

const isUniqueViolation = (error: Error) =>
  error instanceof DrizzleQueryError && error.cause instanceof postgres.PostgresError && error.cause.code === UNIQUE_VIOLATION;

const toHttpError = (error: ExpressError) => {
  if (error instanceof HttpError) return error;
  if (isUniqueViolation(error)) return new HttpError(409, 'Resource already exists');
  // `expose` is set by http-errors (e.g. body-parser) on messages that are safe to show clients.
  if (error.status && error.expose) return new HttpError(error.status, error.message);
  return new HttpError(500, 'Internal Server Error');
};

export const errorHandler = (error: ExpressError, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);

  const { status, message } = toHttpError(error);
  if (status >= 500) logJson({ requestId: req.id, method: req.method, url: req.originalUrl, error: error.message, stack: error.stack }, true);

  res.status(status).json({ errors: [{ message }] });
};
