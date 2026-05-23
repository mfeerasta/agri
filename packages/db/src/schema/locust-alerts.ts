import { date, decimal, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const locustAlerts = zameen.table(
  'locust_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    reportedOn: date('reported_on').notNull(),
    country: text('country').notNull(),
    region: text('region'),
    lat: decimal('lat', { precision: 9, scale: 6 }).notNull(),
    lng: decimal('lng', { precision: 9, scale: 6 }).notNull(),
    swarmStage: text('swarm_stage').notNull(),
    size: text('size'),
    distanceKm: decimal('distance_km', { precision: 8, scale: 2 }),
    sourceUrl: text('source_url'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityReported: index('idx_locust_entity').on(t.entityId, t.reportedOn),
    stageDistance: index('idx_locust_stage_distance').on(t.entityId, t.swarmStage, t.distanceKm),
    uniqueReport: uniqueIndex('uq_locust_report').on(t.entityId, t.lat, t.lng, t.reportedOn),
  }),
);
