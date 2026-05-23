import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

export const liveActivity = zameen.table('live_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid('actor_id'),
  actorName: text('actor_name'),
  actorRole: text('actor_role'),
  activityKind: text('activity_kind').notNull(),
  resourceKind: text('resource_kind'),
  resourceId: uuid('resource_id'),
  fieldId: uuid('field_id').references(() => fields.id),
  summary: text('summary').notNull(),
  summaryUr: text('summary_ur'),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  severity: text('severity').notNull().default('info'),
});

export type LiveActivityRow = typeof liveActivity.$inferSelect;
export type LiveActivitySeverity = 'info' | 'warn' | 'alert' | 'critical';
