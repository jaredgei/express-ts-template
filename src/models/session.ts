import { index, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from '@/models/user';

import { createModel } from '@/utils/schema';

export const { table: sessions } = createModel(
  'sessions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  [],
  (table) => [index('sessions_user_id_idx').on(table.userId), index('sessions_expires_at_idx').on(table.expiresAt)],
);
