import { z } from 'zod';

import { logJson } from '@/utils/logger';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8008),
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DATABASE_PREPARE: z.stringbool().default(true),
  CORS_ORIGIN: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z
          .string()
          .refine(
            (origin) => /^https?:\/\/[^/]+$/.test(origin) && URL.canParse(origin) && new URL(origin).origin === origin,
            'Must be a bare http(s) origin like https://app.example.com',
          ),
      ),
    ),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).default(0),
  FRONTEND_DIR: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logJson({ message: 'Invalid environment variables', fieldErrors: z.flattenError(parsed.error).fieldErrors }, true);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
