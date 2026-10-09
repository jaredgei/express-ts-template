import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';

let adminUrl: URL;
let testDb: string;

const withAdmin = async (run: (sql: postgres.Sql) => Promise<unknown>) => {
  const sql = postgres(adminUrl.href, { onnotice: () => {} });
  try {
    await run(sql);
  } finally {
    await sql.end();
  }
};

export async function setup(project: TestProject) {
  const testUrl = new URL(project.config.env.DATABASE_URL ?? '');
  testDb = decodeURIComponent(testUrl.pathname.slice(1));
  if (!testDb.endsWith('_test')) throw new Error(`Refusing to recreate "${testDb}": the test database name must end in _test`);

  adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';

  await withAdmin(async (sql) => {
    await sql`DROP DATABASE IF EXISTS ${sql(testDb)} WITH (FORCE)`;
    await sql`CREATE DATABASE ${sql(testDb)}`;
  });

  const testSql = postgres(testUrl.href, { max: 1, onnotice: () => {} });
  await migrate(drizzle(testSql), { migrationsFolder: './drizzle' });
  await testSql.end();
}

export async function teardown() {
  await withAdmin((sql) => sql`DROP DATABASE IF EXISTS ${sql(testDb)} WITH (FORCE)`);
}
