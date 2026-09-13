import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@/models';
import { env } from '@/utils/env';

// Disable prefetch for compatibility with transaction poolers (like PgBouncer/Supabase)
export const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

export async function testConnection() {
  try {
    await client`SELECT 1`;
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}
