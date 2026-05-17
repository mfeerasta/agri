import { decimal, jsonb, text, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';
import { cropSeasonEnum, cropStageEnum } from './enums.js';

export const cropProfiles = zameen.table('crop_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  scientificName: text('scientific_name'),
  season: cropSeasonEnum('season').notNull(),
  growthDurationDays: integer('growth_duration_days'),
  stageTimeline: jsonb('stage_timeline'),
  recommendedInputs: jsonb('recommended_inputs'),
  yieldBenchmarkPerAcre: decimal('yield_benchmark_per_acre', { precision: 12, scale: 4 }),
  yieldUnit: varchar('yield_unit', { length: 16 }).notNull().default('mann'),
  notes: text('notes'),
});

export const cropPlans = zameen.table('crop_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropProfileId: uuid('crop_profile_id').notNull().references(() => cropProfiles.id),
  season: cropSeasonEnum('season').notNull(),
  seasonLabel: varchar('season_label', { length: 32 }).notNull(),
  varietyName: text('variety_name'),
  plannedSowingDate: timestamp('planned_sowing_date', { withTimezone: true }),
  actualSowingDate: timestamp('actual_sowing_date', { withTimezone: true }),
  plannedHarvestDate: timestamp('planned_harvest_date', { withTimezone: true }),
  plannedAcres: decimal('planned_acres', { precision: 12, scale: 4 }).notNull(),
  expectedYieldPerAcre: decimal('expected_yield_per_acre', { precision: 12, scale: 4 }),
  budgetPkr: decimal('budget_pkr', { precision: 14, scale: 2 }),
  currentStage: cropStageEnum('current_stage').notNull().default('planned'),
  feasibilityStudyId: uuid('feasibility_study_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cropStageLogs = zameen.table('crop_stage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  cropPlanId: uuid('crop_plan_id').notNull().references(() => cropPlans.id, { onDelete: 'cascade' }),
  stage: cropStageEnum('stage').notNull(),
  observedOn: timestamp('observed_on', { withTimezone: true }).notNull(),
  observedBy: uuid('observed_by'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  ndviSnapshot: jsonb('ndvi_snapshot'),
});

export const harvestRecords = zameen.table('harvest_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  cropPlanId: uuid('crop_plan_id').notNull().references(() => cropPlans.id, { onDelete: 'cascade' }),
  harvestedOn: timestamp('harvested_on', { withTimezone: true }).notNull(),
  acresHarvested: decimal('acres_harvested', { precision: 12, scale: 4 }).notNull(),
  grossYieldKg: decimal('gross_yield_kg', { precision: 14, scale: 2 }).notNull(),
  moisturePct: decimal('moisture_pct', { precision: 5, scale: 2 }),
  graders: jsonb('graders'),
  laborCostPkr: decimal('labor_cost_pkr', { precision: 14, scale: 2 }),
  machineryCostPkr: decimal('machinery_cost_pkr', { precision: 14, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
