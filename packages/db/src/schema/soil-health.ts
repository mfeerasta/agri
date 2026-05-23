import { date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';

// Soil health cards, sampling events, and fertilizer recommendations.
// Live schema: supabase/migrations/0074_soil_health_cards.sql.

export type SoilTextureClass =
  | 'sand'
  | 'loamy_sand'
  | 'sandy_loam'
  | 'loam'
  | 'silt_loam'
  | 'silt'
  | 'sandy_clay_loam'
  | 'clay_loam'
  | 'silty_clay_loam'
  | 'sandy_clay'
  | 'silty_clay'
  | 'clay';

export type SalinityClass =
  | 'non_saline'
  | 'slightly_saline'
  | 'moderately_saline'
  | 'strongly_saline'
  | 'very_strongly_saline';

export type SodicityClass =
  | 'non_sodic'
  | 'slightly_sodic'
  | 'moderately_sodic'
  | 'strongly_sodic';

export type SamplingMethod =
  | 'grid_systematic'
  | 'random'
  | 'zone_based'
  | 'composite_w'
  | 'single_point';

export type SamplingStatus =
  | 'planned'
  | 'collected'
  | 'sent'
  | 'results_received'
  | 'completed';

export const soilHealthCards = zameen.table('soil_health_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cardNumber: text('card_number').notNull(),
  issuedOn: date('issued_on').notNull(),
  validUntil: date('valid_until').notNull(),
  laboratory: text('laboratory'),
  laboratoryCertificateUrl: text('laboratory_certificate_url'),
  compositeSampleCount: integer('composite_sample_count'),
  ph: decimal('ph', { precision: 4, scale: 2 }),
  electricalConductivityDsPerM: decimal('electrical_conductivity_ds_per_m', { precision: 6, scale: 3 }),
  organicMatterPct: decimal('organic_matter_pct', { precision: 5, scale: 2 }),
  organicCarbonPct: decimal('organic_carbon_pct', { precision: 5, scale: 2 }),
  cecCmolPerKg: decimal('cec_cmol_per_kg', { precision: 6, scale: 2 }),
  nitrogenTotalPct: decimal('nitrogen_total_pct', { precision: 6, scale: 3 }),
  phosphorusAvailPpm: decimal('phosphorus_avail_ppm', { precision: 8, scale: 2 }),
  potassiumAvailPpm: decimal('potassium_avail_ppm', { precision: 8, scale: 2 }),
  sulphurPpm: decimal('sulphur_ppm', { precision: 8, scale: 2 }),
  zincPpm: decimal('zinc_ppm', { precision: 6, scale: 2 }),
  ironPpm: decimal('iron_ppm', { precision: 6, scale: 2 }),
  manganesePpm: decimal('manganese_ppm', { precision: 6, scale: 2 }),
  copperPpm: decimal('copper_ppm', { precision: 6, scale: 2 }),
  boronPpm: decimal('boron_ppm', { precision: 6, scale: 2 }),
  textureClass: text('texture_class').$type<SoilTextureClass>(),
  clayPct: decimal('clay_pct', { precision: 5, scale: 2 }),
  sandPct: decimal('sand_pct', { precision: 5, scale: 2 }),
  siltPct: decimal('silt_pct', { precision: 5, scale: 2 }),
  bulkDensityGPerCm3: decimal('bulk_density_g_per_cm3', { precision: 5, scale: 3 }),
  infiltrationRateCmPerHr: decimal('infiltration_rate_cm_per_hr', { precision: 6, scale: 3 }),
  carbonatePct: decimal('carbonate_pct', { precision: 5, scale: 2 }),
  salinityClass: text('salinity_class').$type<SalinityClass>(),
  sodicityClass: text('sodicity_class').$type<SodicityClass>(),
  aiSummary: text('ai_summary'),
  aiSummaryUr: text('ai_summary_ur'),
  fullReportUrl: text('full_report_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const soilSamplingEvents = zameen.table('soil_sampling_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  sampledOn: date('sampled_on').notNull(),
  sampledBy: uuid('sampled_by'),
  samplingMethod: text('sampling_method').$type<SamplingMethod>(),
  sampleCount: integer('sample_count').notNull(),
  depthCm: integer('depth_cm').notNull(),
  gpsLocations: jsonb('gps_locations')
    .$type<Array<{ lat: number; lng: number; label?: string }>>()
    .notNull()
    .default([]),
  sentToLab: text('sent_to_lab'),
  labReferenceNumber: text('lab_reference_number'),
  expectedResultDate: date('expected_result_date'),
  status: text('status').$type<SamplingStatus>().notNull().default('collected'),
  resultingCardId: uuid('resulting_card_id').references(() => soilHealthCards.id),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  costPkr: decimal('cost_pkr', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fertilizerRecommendations = zameen.table('fertilizer_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => soilHealthCards.id, { onDelete: 'cascade' }),
  cropCode: text('crop_code').notNull(),
  targetYieldKgPerAcre: decimal('target_yield_kg_per_acre', { precision: 10, scale: 2 }).notNull(),
  nKgPerAcre: decimal('n_kg_per_acre', { precision: 8, scale: 2 }).notNull(),
  p2o5KgPerAcre: decimal('p2o5_kg_per_acre', { precision: 8, scale: 2 }).notNull(),
  k2oKgPerAcre: decimal('k2o_kg_per_acre', { precision: 8, scale: 2 }).notNull(),
  zincKgPerAcre: decimal('zinc_kg_per_acre', { precision: 6, scale: 2 }),
  sulphurKgPerAcre: decimal('sulphur_kg_per_acre', { precision: 6, scale: 2 }),
  microsJsonb: jsonb('micros_jsonb').$type<Record<string, number>>(),
  organicRecommendations: text('organic_recommendations'),
  aiRationale: text('ai_rationale'),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});
