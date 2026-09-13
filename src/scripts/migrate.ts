import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '@/utils/env';

(async () => {
  console.log('Running database migrations...');
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully.');

  await client.end();
})().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
