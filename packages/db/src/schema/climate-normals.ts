import { integer, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const climateNormals = zameen.table('climate_normals', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  startYear: integer('start_year').notNull(),
  endYear: integer('end_year').notNull(),
  monthlyMeanTempC: numeric('monthly_mean_temp_c', { precision: 5, scale: 2 }).array().notNull(),
  monthlyTotalRainMm: numeric('monthly_total_rain_mm', { precision: 7, scale: 2 }).array().notNull(),
  monthlyEt0Mm: numeric('monthly_et0_mm', { precision: 6, scale: 2 }).array().notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source').notNull().default('nasa-power'),
});
