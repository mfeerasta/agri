import { boolean, date, integer, jsonb, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

export const sustainabilityPractices = zameen.table('sustainability_practices', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').references(() => fields.id),
  practiceKind: text('practice_kind').notNull(),
  startedOn: date('started_on').notNull(),
  endedOn: date('ended_on'),
  areaAcres: numeric('area_acres', { precision: 10, scale: 3 }),
  baselineMetric: jsonb('baseline_metric'),
  currentMetric: jsonb('current_metric'),
  evidenceUrls: jsonb('evidence_urls').$type<string[]>().notNull().default([]),
  verifier: text('verifier'),
  verificationDate: date('verification_date'),
  certification: text('certification'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const carbonAssessments = zameen.table('carbon_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').references(() => fields.id),
  assessmentDate: date('assessment_date').notNull(),
  scopeCo2eTons: jsonb('scope_co2e_tons').notNull(),
  totalEmissionsCo2eTons: numeric('total_emissions_co2e_tons', { precision: 12, scale: 3 }).notNull(),
  totalSequestrationCo2eTons: numeric('total_sequestration_co2e_tons', { precision: 12, scale: 3 }).notNull(),
  netCo2eTons: numeric('net_co2e_tons', { precision: 12, scale: 3 }).notNull(),
  baselineYear: integer('baseline_year'),
  reductionVsBaselinePct: numeric('reduction_vs_baseline_pct', { precision: 5, scale: 2 }),
  methodology: text('methodology'),
  verifiedBy: text('verified_by'),
  certificateUrl: text('certificate_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const carbonCredits = zameen.table('carbon_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  creditNumber: text('credit_number'),
  issuedBy: text('issued_by'),
  standard: text('standard'),
  issuedOn: date('issued_on'),
  vintageYear: integer('vintage_year').notNull(),
  quantityTco2e: numeric('quantity_tco2e', { precision: 14, scale: 3 }).notNull(),
  status: text('status').notNull().default('issued'),
  soldTo: text('sold_to'),
  soldOn: date('sold_on'),
  soldPricePerTonPkr: numeric('sold_price_per_ton_pkr', { precision: 12, scale: 2 }),
  totalRevenuePkr: numeric('total_revenue_pkr', { precision: 14, scale: 2 }),
  retirementReason: text('retirement_reason'),
  relatedPracticeIds: jsonb('related_practice_ids').$type<string[]>(),
  relatedAssessmentId: uuid('related_assessment_id').references(() => carbonAssessments.id),
  certificateUrl: text('certificate_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const esgMetricsSnapshots = zameen.table('esg_metrics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  snapshotDate: date('snapshot_date').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  environmental: jsonb('environmental').notNull(),
  social: jsonb('social').notNull(),
  governance: jsonb('governance').notNull(),
  framework: text('framework'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
