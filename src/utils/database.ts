import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

// Disable prefetch for compatibility with transaction poolers (like PgBouncer/Supabase)
export const client = postgres(databaseUrl, { prepare: false });

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
