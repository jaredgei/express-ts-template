import { getTableColumns, BuildExtraConfigColumns } from 'drizzle-orm';
import { pgTable, PgColumnBuilderBase, PgTableExtraConfigValue, uuid, timestamp } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';

const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

type BaseColumns = typeof baseColumns;
type Columns = Record<string, PgColumnBuilderBase>;

export function createModel<TName extends string, TColumns extends Columns, TPrivate extends keyof TColumns = never>(
  name: TName,
  columns: TColumns,
  privateColumns: readonly TPrivate[] = [],
  indexes?: (table: BuildExtraConfigColumns<TName, BaseColumns & TColumns, 'pg'>) => PgTableExtraConfigValue[],
) {
  const table = pgTable<TName, BaseColumns & TColumns>(name, { ...baseColumns, ...columns }, indexes);
  const privateSet = new Set<PropertyKey>(privateColumns);

  const publicColumns = Object.fromEntries(Object.entries(getTableColumns(table)).filter(([key]) => !privateSet.has(key))) as Omit<
    ReturnType<typeof getTableColumns<typeof table>>,
    TPrivate
  >;

  const selectSchema = createSelectSchema(table);
  const mask = Object.fromEntries(privateColumns.map((key) => [key, true])) as Parameters<typeof selectSchema.omit>[0];

  return {
    table,
    publicColumns,
    publicSelectSchema: selectSchema.omit(mask),
  };
}
