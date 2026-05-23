import { decimal, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const airQualityReadings = zameen.table('air_quality_readings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  stationName: text('station_name').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  pm25: decimal('pm25', { precision: 6, scale: 2 }),
  pm10: decimal('pm10', { precision: 6, scale: 2 }),
  no2: decimal('no2', { precision: 6, scale: 2 }),
  o3: decimal('o3', { precision: 6, scale: 2 }),
  so2: decimal('so2', { precision: 6, scale: 2 }),
  co: decimal('co', { precision: 6, scale: 2 }),
  aqi: integer('aqi'),
  level: text('level'),
});
