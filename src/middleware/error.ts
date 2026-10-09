import { DrizzleQueryError } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import postgres from 'postgres';
import { z } from 'zod';

import { errorFields, logJson, requestFields } from '@/utils/logger';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

export const errorResponseSchema = z.object({ errors: z.array(z.object({ message: z.string(), field: z.string().optional() })) });

export type ErrorDetail = z.infer<typeof errorResponseSchema>['errors'][number];

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

const pgErrorCode = (error: unknown) =>
  error instanceof DrizzleQueryError && error.cause instanceof postgres.PostgresError ? error.cause.code : undefined;

// http-errors (thrown by body-parser) sets `expose` on errors whose message is safe to show clients.
const isExposedHttpError = (error: unknown): error is Error & { status: number } =>
  error instanceof Error && 'expose' in error && error.expose === true && 'status' in error && typeof error.status === 'number';

const toHttpError = (error: unknown): HttpError => {
  if (error instanceof HttpError) return error;
  const code = pgErrorCode(error);
  if (code === UNIQUE_VIOLATION) return new HttpError(409, 'Resource already exists');
  if (code === FOREIGN_KEY_VIOLATION) return new HttpError(409, 'Related resource does not exist');
  if (isExposedHttpError(error)) return new HttpError(error.status, error.message);
  return new HttpError(500, 'Internal Server Error');
};

export const errorHandler = (error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);

  const httpError = toHttpError(error);
  if (httpError.status >= 500) logJson({ ...requestFields(req), ...errorFields(error) }, true);

  res.status(httpError.status).json({ errors: httpError.errors });
};
