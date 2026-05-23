import { decimal, integer, jsonb, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';
import { cropDiagnostics } from './crop-diagnostics.js';

// Scouting + IPM. See supabase/migrations/0066_scouting_ipm.sql for the live
// schema (CHECK constraints, indexes, RLS policies). Drizzle mirrors columns
// for type-safe queries, no PostGIS columns involved.

export type ScoutMethod =
  | 'w_pattern'
  | 'x_pattern'
  | 'random'
  | 'perimeter'
  | 'full_field';

export const scoutingObservations = zameen.table('scouting_observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  observerId: uuid('observer_id'),
  scoutMethod: text('scout_method').$type<ScoutMethod>(),
  sampleCount: integer('sample_count'),
  pestOrDisease: text('pest_or_disease').notNull(),
  severity: integer('severity').notNull(),
  prevalencePct: decimal('prevalence_pct', { precision: 5, scale: 2 }),
  growthStage: text('growth_stage'),
  gpsLocation: jsonb('gps_location').$type<{ lat: number; lng: number; accuracy?: number } | null>(),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  voiceNoteUrl: text('voice_note_url'),
  aiDiagnosticId: uuid('ai_diagnostic_id').references(() => cropDiagnostics.id, { onDelete: 'set null' }),
  recommendedAction: text('recommended_action'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const actionThresholds = zameen.table(
  'action_thresholds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    cropCode: text('crop_code').notNull(),
    pestOrDisease: text('pest_or_disease').notNull(),
    thresholdSeverity: integer('threshold_severity'),
    thresholdPrevalencePct: decimal('threshold_prevalence_pct', { precision: 5, scale: 2 }),
    recommendedResponse: text('recommended_response').notNull(),
    ipmNotes: text('ipm_notes'),
    source: text('source'),
  },
  (t) => ({
    uniqEntityCropPest: unique('action_thresholds_entity_crop_pest_key').on(
      t.entityId,
      t.cropCode,
      t.pestOrDisease,
    ).nullsNotDistinct(),
  }),
);

export const beneficialInsectLogs = zameen.table('beneficial_insect_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  species: text('species').notNull(),
  countEstimate: integer('count_estimate'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
