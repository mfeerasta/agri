import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

/**
 * Server-side idempotency cache for retry-safe POST/PUT/DELETE.
 * Backed by zameen.idempotency_log (migration 0008). Used by every bespoke
 * mutation route via withIdempotency() from @zameen/shared/idempotency.
 */
export const idempotencyLog = zameen.table('idempotency_log', {
  idempotencyKey: text('idempotency_key').primaryKey(),
  userId: uuid('user_id'),
  requestHash: text('request_hash'),
  response: jsonb('response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
