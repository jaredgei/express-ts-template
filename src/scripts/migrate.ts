import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '@/utils/env';
import { logJson } from '@/utils/logger';

(async () => {
  logJson({ message: 'Running database migrations' });
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './drizzle' });
  logJson({ message: 'Migrations completed' });

  await client.end();
})().catch((error) => {
  logJson({ message: 'Migration failed', error: String(error) }, true);
  process.exit(1);
});
