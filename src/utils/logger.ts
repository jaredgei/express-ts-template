import { DrizzleQueryError } from 'drizzle-orm';
import { Request } from 'express';

export const logJson = (fields: Record<string, unknown>, error = false) =>
  (error ? console.error : console.log)(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));

export const requestFields = (req: Request) => ({ requestId: req.id, method: req.method, path: req.originalUrl.replace(/\?.*/s, '') });

// DrizzleQueryError's message embeds bound parameters (emails, password hashes): keep its SQL and call-site frames, take the message from the driver.
export const errorFields = (error: unknown): Record<string, unknown> => {
  if (error instanceof DrizzleQueryError)
    return { ...errorFields(error.cause), query: error.query, stack: error.stack?.replace(`${error.name}: ${error.message}`, '') };
  if (error instanceof Error) return { error: error.message, stack: error.stack };
  return { error: String(error) };
};
