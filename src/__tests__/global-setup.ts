import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';

let TEST_DB: string;
let BASE_URL: string;

export async function setup(project: TestProject) {
  const dbUrl = new URL(project.config.env.DATABASE_URL ?? '');
  TEST_DB = dbUrl.pathname.slice(1);
  BASE_URL = `postgresql://${dbUrl.username}:${dbUrl.password}@${dbUrl.host}`;

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
