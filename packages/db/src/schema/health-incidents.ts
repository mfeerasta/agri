import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

/**
 * Operational incidents raised by the supabase health-monitor edge function.
 * Surfaced on /admin/status. Severity tracks how bad it is; acknowledged_by
 * lets a director silence noisy alerts without resolving them.
 */
export const healthIncidents = zameen.table('health_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  severity: text('severity').notNull(),
  scope: text('scope').notNull(),
  message: text('message').notNull(),
  meta: jsonb('meta'),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
