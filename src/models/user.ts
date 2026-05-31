import { varchar } from 'drizzle-orm/pg-core';
import { createModel } from '../utils/schema';

export const {
  table: users,
  selectSchema: rawSelectUserSchema,
  insertSchema: insertUserSchema,
} = createModel('users', {
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
});

// Securely omit the password hash from the public API schema
export const selectUserSchema = rawSelectUserSchema.omit({ passwordHash: true });

// Infer typescript types automatically
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
