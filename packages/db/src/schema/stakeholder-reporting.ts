import { boolean, date, jsonb, numeric, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const stakeholders = zameen.table('stakeholders', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  stakeholderKind: text('stakeholder_kind').notNull(),
  contactPerson: text('contact_person'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  exposurePkr: numeric('exposure_pkr', { precision: 14, scale: 2 }),
  reportingFrequency: text('reporting_frequency').notNull(),
  nextReportDue: date('next_report_due'),
  reportingRequirements: jsonb('reporting_requirements'),
  signedAgreementUrl: text('signed_agreement_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stakeholderReports = zameen.table('stakeholder_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  stakeholderId: uuid('stakeholder_id').notNull().references(() => stakeholders.id, { onDelete: 'cascade' }),
  reportPeriodStart: date('report_period_start').notNull(),
  reportPeriodEnd: date('report_period_end').notNull(),
  dueDate: date('due_date').notNull(),
  submittedOn: date('submitted_on'),
  status: text('status').notNull().default('draft'),
  pdfUrl: text('pdf_url'),
  dataSnapshot: jsonb('data_snapshot'),
  coverLetter: text('cover_letter'),
  submittedToEmail: text('submitted_to_email'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kpiDefinitions = zameen.table(
  'kpi_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    unit: text('unit').notNull(),
    formulaDescription: text('formula_description'),
    targetValue: numeric('target_value', { precision: 14, scale: 4 }),
    targetPeriod: text('target_period'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex('uq_kpi_definitions_code_drizzle').on(t.entityId, t.code),
  }),
);

export const kpiActuals = zameen.table(
  'kpi_actuals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kpiId: uuid('kpi_id').notNull().references(() => kpiDefinitions.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    value: numeric('value', { precision: 14, scale: 4 }).notNull(),
    targetValue: numeric('target_value', { precision: 14, scale: 4 }),
    variancePct: numeric('variance_pct', { precision: 8, scale: 2 }),
    notes: text('notes'),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    periodIdx: uniqueIndex('uq_kpi_actuals_period_drizzle').on(t.kpiId, t.periodStart, t.periodEnd),
  }),
);

export type Stakeholder = typeof stakeholders.$inferSelect;
export type StakeholderReport = typeof stakeholderReports.$inferSelect;
export type KpiDefinition = typeof kpiDefinitions.$inferSelect;
export type KpiActual = typeof kpiActuals.$inferSelect;

export const STAKEHOLDER_KINDS = [
  'lender_bank',
  'lender_microfinance',
  'grant_provider',
  'impact_investor',
  'government',
  'offtake_buyer',
  'certification_body',
  'partner_ngo',
  'other',
] as const;
export type StakeholderKind = (typeof STAKEHOLDER_KINDS)[number];

export const REPORTING_FREQUENCIES = [
  'weekly',
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'event_based',
  'on_demand',
] as const;
export type ReportingFrequency = (typeof REPORTING_FREQUENCIES)[number];

export const STAKEHOLDER_REPORT_STATUSES = [
  'draft',
  'review',
  'approved',
  'submitted',
  'acknowledged',
  'overdue',
] as const;
export type StakeholderReportStatus = (typeof STAKEHOLDER_REPORT_STATUSES)[number];

export const KPI_CATEGORIES = ['financial', 'operational', 'social', 'environmental', 'governance'] as const;
export type KpiCategory = (typeof KPI_CATEGORIES)[number];
