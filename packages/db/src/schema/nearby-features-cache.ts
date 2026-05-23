import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

export const nearbyFeaturesCache = zameen.table('nearby_features_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  originKind: text('origin_kind').notNull(),
  originId: uuid('origin_id').notNull(),
  features: jsonb('features').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
