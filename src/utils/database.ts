import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/utils/env';

import * as schema from '@/models';

export const client = postgres(env.DATABASE_URL, {
  // Disable prepared statements for compatibility with transaction poolers (PgBouncer/Supabase).
  prepare: false,
  max: env.DATABASE_POOL_MAX,
  idle_timeout: 30,
  connect_timeout: 10,
  connection: { statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS },
});

export const db = drizzle(client, { schema });

export async function testConnection() {
  await client`SELECT 1`;
  console.log('Database connection established.');
}
