import { integer, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

export const slowQueries = zameen.table(
  'slow_queries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sqlText: text('sql_text').notNull(),
    durationMs: integer('duration_ms').notNull(),
    caller: text('caller'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byRecent: index('idx_slow_queries_recent').on(t.occurredAt),
  }),
);

export type SlowQuery = typeof slowQueries.$inferSelect;
export type SlowQueryInsert = typeof slowQueries.$inferInsert;
