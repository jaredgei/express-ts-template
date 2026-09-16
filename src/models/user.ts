import { varchar } from 'drizzle-orm/pg-core';

import { createModel } from '@/utils/schema';

export const {
  table: users,
  publicColumns: publicUserColumns,
  publicSelectSchema: selectUserSchema,
} = createModel(
  'users',
  {
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  },
  ['passwordHash'],
);
