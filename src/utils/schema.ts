import { pgTable, PgColumnBuilderBase, uuid, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

/**
 * Standard base columns that every table/model in our application should have.
 */
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

/**
 * A highly extensible factory to define standard database models.
 * Automatically appends:
 * - `id` (UUID primary key)
 * - `createdAt` & `updatedAt` (Timestamps)
 *
 * And auto-generates:
 * - `selectSchema` (Zod schema for select queries)
 * - `insertSchema` (Zod schema for inserts)
 */
export function createModel<TName extends string, TColumns extends { [columnName: string]: PgColumnBuilderBase }>(name: TName, columns: TColumns) {
  const table = pgTable(name, {
    ...baseColumns,
    ...columns,
  });

  return {
    table,
    selectSchema: createSelectSchema(table),
    insertSchema: createInsertSchema(table),
  };
}
