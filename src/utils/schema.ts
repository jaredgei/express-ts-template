import { pgTable, PgColumnBuilderBase, uuid, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

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
