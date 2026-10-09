import { DrizzleQueryError } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import postgres from 'postgres';

import { errorFields, logJson } from '@/utils/logger';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

export type ErrorDetail = { message: string; field?: string };

export class HttpError extends Error {
  readonly errors: ErrorDetail[];

  constructor(
    readonly status: number,
    message: string,
    field?: string,
  ) {
    super(message);
    this.errors = [field ? { message, field } : { message }];
  }
}

export class ValidationError extends HttpError {
  constructor(readonly errors: ErrorDetail[]) {
    super(400, 'Validation failed');
  }
}

type ExpressError = Error & { status?: number; expose?: boolean };

const pgErrorCode = (error: Error) =>
  error instanceof DrizzleQueryError && error.cause instanceof postgres.PostgresError ? error.cause.code : undefined;

const toHttpError = (error: ExpressError): HttpError => {
  if (error instanceof HttpError) return error;
  const code = pgErrorCode(error);
  if (code === UNIQUE_VIOLATION) return new HttpError(409, 'Resource already exists');
  if (code === FOREIGN_KEY_VIOLATION) return new HttpError(409, 'Related resource does not exist');
  // `expose` is set by http-errors (e.g. body-parser) on messages that are safe to show clients.
  if (error.status && error.expose) return new HttpError(error.status, error.message);
  return new HttpError(500, 'Internal Server Error');
};

export const errorHandler = (error: ExpressError, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);

  const httpError = toHttpError(error);
  if (httpError.status >= 500) logJson({ requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], ...errorFields(error) }, true);

  res.status(httpError.status).json({ errors: httpError.errors });
};
