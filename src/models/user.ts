import { varchar } from 'drizzle-orm/pg-core';
import { createModel } from '../utils/schema';

export const {
  table: users,
  selectSchema: selectUserSchema,
  insertSchema: insertUserSchema,
} = createModel('users', {
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
});

// Infer typescript types automatically
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
