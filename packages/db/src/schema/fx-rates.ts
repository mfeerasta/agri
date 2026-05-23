import { date, decimal, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

export const fxRates = zameen.table(
  'fx_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date').notNull(),
    baseCurrency: text('base_currency').notNull(),
    quoteCurrency: text('quote_currency').notNull(),
    rate: decimal('rate', { precision: 14, scale: 6 }).notNull(),
    source: text('source').notNull().default('exchangerate.host'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDate: index('idx_fx_date').on(t.date),
    byPair: index('idx_fx_pair').on(t.baseCurrency, t.quoteCurrency, t.date),
    uniquePair: uniqueIndex('uq_fx_pair_day').on(t.date, t.baseCurrency, t.quoteCurrency, t.source),
  }),
);
