import { sql } from 'drizzle-orm';
import { uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { createModel } from '@/utils/schema';

export const {
  table: users,
  publicColumns: publicUserColumns,
  publicSelectSchema: selectUserSchema,
} = createModel(
  'users',
  {
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  },
  { private: ['passwordHash'], indexes: (table) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`)] },
);
