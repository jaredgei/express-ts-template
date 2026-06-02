import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

(async () => {
  console.log('Running database migrations...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully.');

  await client.end();
})().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
