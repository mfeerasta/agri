import { boolean, date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

// Variety catalogue + multi-season trials + per-harvest loss tracking.
// Yield optimization rests on three tables here. Cross-season trends are
// computed in @zameen/finance/variety-performance.

export type VarietyKind = 'open_pollinated' | 'hybrid' | 'f1' | 'desi' | 'imported' | 'heirloom';

export const cropVarieties = zameen.table('crop_varieties', {
  id: uuid('id').primaryKey().defaultRandom(),
  cropProfileCode: text('crop_profile_code').notNull(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  varietyKind: text('variety_kind').$type<VarietyKind>(),
  sourceCompany: text('source_company'),
  releaseYear: integer('release_year'),
  attributes: jsonb('attributes').$type<Record<string, unknown>>(),
  recommendedForZones: text('recommended_for_zones').array(),
  resistanceTraits: text('resistance_traits').array(),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LossKind =
  | 'shattering'
  | 'spillage'
  | 'rain_damage'
  | 'bird_damage'
  | 'rodent_damage'
  | 'storage_pest'
  | 'quality_downgrade'
  | 'rejection'
  | 'other';

export const varietyTrials = zameen.table('variety_trials', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').notNull().references(() => fields.id),
  cropPlanId: uuid('crop_plan_id'),
  varietyId: uuid('variety_id').notNull().references(() => cropVarieties.id),
  season: text('season').notNull(),
  plantedOn: date('planted_on').notNull(),
  harvestedOn: date('harvested_on'),
  areaAcres: decimal('area_acres', { precision: 8, scale: 3 }).notNull(),
  yieldKg: decimal('yield_kg', { precision: 14, scale: 2 }),
  yieldPerAcreKg: decimal('yield_per_acre_kg', { precision: 10, scale: 2 }),
  qualityGrade: text('quality_grade'),
  diseasePressureSeverity: integer('disease_pressure_severity'),
  pestPressureSeverity: integer('pest_pressure_severity'),
  weatherStressNotes: text('weather_stress_notes'),
  netRevenuePkr: decimal('net_revenue_pkr', { precision: 14, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const harvestLossRecords = zameen.table('harvest_loss_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  harvestRecordId: uuid('harvest_record_id').notNull(),
  fieldId: uuid('field_id').references(() => fields.id),
  lossKind: text('loss_kind').$type<LossKind>().notNull(),
  estimatedKg: decimal('estimated_kg', { precision: 14, scale: 2 }).notNull(),
  estimatedValuePkr: decimal('estimated_value_pkr', { precision: 14, scale: 2 }),
  cause: text('cause'),
  preventable: boolean('preventable'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
