import { jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export const entityActivity = zameen.table('entity_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityKind: varchar('entity_kind', { length: 32 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  actorId: uuid('actor_id').references(() => users.id),
  verb: text('verb').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
