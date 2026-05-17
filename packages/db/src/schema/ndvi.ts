import { date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';
import { cropPlans } from './crops.js';

// Sentinel Hub NDVI observations. One row per field per acquisition date per
// satellite. Populated by supabase/functions/ndvi-puller. UI consumers should
// project a friendly stats summary and presigned preview-image URL.

export const ndviObservations = zameen.table('ndvi_observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id').references(() => cropPlans.id, { onDelete: 'set null' }),
  observedOn: date('observed_on').notNull(),
  satellite: text('satellite').notNull().default('sentinel-2'),
  cloudCoverPct: decimal('cloud_cover_pct', { precision: 5, scale: 2 }),
  meanNdvi: decimal('mean_ndvi', { precision: 5, scale: 4 }).notNull(),
  minNdvi: decimal('min_ndvi', { precision: 5, scale: 4 }),
  maxNdvi: decimal('max_ndvi', { precision: 5, scale: 4 }),
  stdNdvi: decimal('std_ndvi', { precision: 5, scale: 4 }),
  pixelsCount: integer('pixels_count'),
  rawResponse: jsonb('raw_response'),
  previewImageUrl: text('preview_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
