import { date, decimal, integer, jsonb, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';

// Agronomic decision-support tables. Live schema:
// supabase/migrations/0095_decision_support.sql. Pure read-write Drizzle
// mirror, no PostGIS columns, all costs in PKR.

export const cropPhenology = zameen.table(
  'crop_phenology',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cropCode: text('crop_code').notNull(),
    stageCode: text('stage_code').notNull(),
    stageName: text('stage_name').notNull(),
    stageNameUr: text('stage_name_ur'),
    bbchCode: integer('bbch_code'),
    gddFromSowing: decimal('gdd_from_sowing', { precision: 8, scale: 2 }),
    daysFromSowing: integer('days_from_sowing'),
    description: text('description'),
    criticalInputs: text('critical_inputs').array(),
    recommendations: text('recommendations'),
  },
  (t) => ({
    uniqCropStage: unique('crop_phenology_crop_stage_unique').on(t.cropCode, t.stageCode),
  }),
);

export const fieldPhenologyLog = zameen.table('field_phenology_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id'),
  observedStageCode: text('observed_stage_code').notNull(),
  observedOn: date('observed_on').notNull(),
  gddAccumulated: decimal('gdd_accumulated', { precision: 10, scale: 2 }),
  daysFromSowing: integer('days_from_sowing'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface SprayWindowFactors {
  temp: { value: number; score: number };
  wind: { value: number; score: number };
  rain: { value: number; score: number };
  humidity: { value: number; score: number };
  phenologyOk: boolean;
  rationaleEn: string;
}

export const sprayWindows = zameen.table('spray_windows', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  recommendedForTarget: text('recommended_for_target').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  score: decimal('score', { precision: 5, scale: 2 }).notNull(),
  factors: jsonb('factors').$type<SprayWindowFactors>().notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export interface NutrientAlternative {
  label: string;
  productKind: string;
  bagsPerAcre: number;
  pkrPerAcre: number;
  notes?: string;
}

export const nutrientRecommendations = zameen.table('nutrient_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id'),
  phenologyStage: text('phenology_stage'),
  computedOn: date('computed_on').notNull(),
  nKgPerAcre: decimal('n_kg_per_acre', { precision: 8, scale: 2 }).notNull(),
  p2o5KgPerAcre: decimal('p2o5_kg_per_acre', { precision: 8, scale: 2 }).notNull(),
  k2oKgPerAcre: decimal('k2o_kg_per_acre', { precision: 8, scale: 2 }).notNull(),
  microsJsonb: jsonb('micros_jsonb').$type<Record<string, number>>(),
  organicAdvice: text('organic_advice'),
  aiRationale: text('ai_rationale'),
  aiRationaleUr: text('ai_rationale_ur'),
  estimatedCostPkr: decimal('estimated_cost_pkr', { precision: 12, scale: 2 }),
  alternativesJsonb: jsonb('alternatives_jsonb').$type<NutrientAlternative[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
