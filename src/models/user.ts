import { getTableColumns } from 'drizzle-orm';
import { varchar } from 'drizzle-orm/pg-core';
import { z } from 'zod';
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

// Exclude passwordHash at the query level — use in all queries except login verification
const { passwordHash: _, ...cols } = getTableColumns(users);
export const publicUserColumns = cols;

// Zod schema for the public user shape (used for validation and OpenAPI docs)
export const selectUserSchema = rawSelectUserSchema.omit({ passwordHash: true });

export type User = z.infer<typeof selectUserSchema>;
