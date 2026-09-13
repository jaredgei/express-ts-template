import { varchar, timestamp, uuid } from 'drizzle-orm/pg-core';

import { createModel } from '@/utils/schema';
import { users } from '@/models/user';

export const { table: sessions } = createModel('sessions', {
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
});
