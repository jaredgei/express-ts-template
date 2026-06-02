import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const TEST_DB = 'express_ts_test';
const dbUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/express_ts_test');
const BASE_URL = `postgresql://${dbUrl.username}:${dbUrl.password}@${dbUrl.host}`;

export async function setup() {
  const admin = postgres(`${BASE_URL}/postgres`);
  await admin.unsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()`);
  await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.unsafe(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const testSql = postgres(`${BASE_URL}/${TEST_DB}`);
  await migrate(drizzle(testSql), { migrationsFolder: './drizzle' });
  await testSql.end();
}

export async function teardown() {
  const admin = postgres(`${BASE_URL}/postgres`);
  await admin.unsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()`);
  await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.end();
}
