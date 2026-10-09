import { BuildExtraConfigColumns, getTableColumns } from 'drizzle-orm';
import { PgColumnBuilderBase, pgTable, PgTableExtraConfigValue, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

type BaseColumns = typeof baseColumns;
type Columns = Record<string, PgColumnBuilderBase>;

type ModelOptions<TName extends string, TColumns extends Columns, TPrivate extends keyof TColumns & string> = {
  private?: readonly TPrivate[];
  indexes?: (table: BuildExtraConfigColumns<TName, BaseColumns & TColumns, 'pg'>) => PgTableExtraConfigValue[];
};

export function createModel<TName extends string, TColumns extends Columns, TPrivate extends keyof TColumns & string = never>(
  name: TName,
  columns: TColumns,
  { private: privateColumns = [], indexes }: ModelOptions<TName, TColumns, TPrivate> = {},
) {
  const table = pgTable<TName, BaseColumns & TColumns>(name, { ...baseColumns, ...columns }, indexes);
  const isPublic = ([key]: [string, unknown]) => !privateColumns.some((column) => column === key);
  const selectSchema = createSelectSchema(table);

  return {
    table,
    publicColumns: Object.fromEntries(Object.entries(getTableColumns(table)).filter(isPublic)) as Omit<
      ReturnType<typeof getTableColumns<typeof table>>,
      TPrivate
    >,
    publicSelectSchema: z.object(Object.fromEntries(Object.entries(selectSchema.shape).filter(isPublic))) as z.ZodObject<
      Omit<(typeof selectSchema)['shape'], TPrivate>
    >,
  };
}
