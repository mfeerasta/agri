import { date, decimal, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';

export const smapObservations = zameen.table(
  'smap_observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    observedOn: date('observed_on').notNull(),
    soilMoistureM3m3: decimal('soil_moisture_m3m3', { precision: 5, scale: 3 }).notNull(),
    retrievalQuality: decimal('retrieval_quality', { precision: 3, scale: 2 }),
    source: text('source').notNull().default('smap'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byField: index('idx_smap_field').on(t.fieldId, t.observedOn),
    uniqueObs: uniqueIndex('uq_smap_field_day').on(t.fieldId, t.observedOn, t.source),
  }),
);
