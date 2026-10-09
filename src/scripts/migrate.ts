import path from 'path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '@/utils/env';
import { errorFields, logJson } from '@/utils/logger';

(async () => {
  logJson({ message: 'Running database migrations' });
  const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, '../../drizzle') });
  logJson({ message: 'Migrations completed' });

  await client.end();
})().catch((error) => {
  logJson({ message: 'Migration failed', ...errorFields(error) }, true);
  process.exit(1);
});
