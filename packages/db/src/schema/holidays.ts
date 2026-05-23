import { boolean, date, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

/**
 * Pakistan public + religious holiday cache. Sourced from Nager + Aladhan
 * by the holidays-sync edge function. Read by payroll-divisor + dashboard.
 */
export const holidays = zameen.table(
  'holidays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date').notNull(),
    hijriDate: text('hijri_date'),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    kind: text('kind').notNull(),
    fixed: boolean('fixed').notNull().default(false),
    source: text('source').notNull().default('nager'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqDateName: unique('holidays_date_name_uniq').on(t.date, t.name),
  }),
);

export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
