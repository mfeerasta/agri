import { boolean, date, decimal, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

export const taxPeriods = zameen.table('tax_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  taxKind: text('tax_kind').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  dueOn: date('due_on').notNull(),
  filingStatus: text('filing_status').notNull().default('pending'),
  computedAmountPkr: decimal('computed_amount_pkr', { precision: 14, scale: 2 }),
  paidAmountPkr: decimal('paid_amount_pkr', { precision: 14, scale: 2 }),
  paidOn: date('paid_on'),
  challanNumber: text('challan_number'),
  challanUrl: text('challan_url'),
  filingEvidenceUrl: text('filing_evidence_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ushrSettlements = zameen.table('ushr_settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  harvestRecordId: uuid('harvest_record_id'),
  cropPlanId: uuid('crop_plan_id'),
  irrigated: boolean('irrigated').notNull(),
  grossProduceKg: decimal('gross_produce_kg', { precision: 14, scale: 2 }).notNull(),
  ushrRatePct: decimal('ushr_rate_pct', { precision: 5, scale: 2 }).notNull(),
  ushrKg: decimal('ushr_kg', { precision: 14, scale: 2 }).notNull(),
  ushrValuePkr: decimal('ushr_value_pkr', { precision: 14, scale: 2 }),
  settledOn: date('settled_on'),
  paidTo: text('paid_to'),
  paidInKind: boolean('paid_in_kind').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const zakatAssessments = zameen.table('zakat_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  assessmentDate: date('assessment_date').notNull(),
  hijriYear: integer('hijri_year').notNull(),
  nisabPkr: decimal('nisab_pkr', { precision: 14, scale: 2 }).notNull(),
  cashPkr: decimal('cash_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  bankBalancesPkr: decimal('bank_balances_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  receivablesPkr: decimal('receivables_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  inventoryValuePkr: decimal('inventory_value_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  liquidLivestockValuePkr: decimal('liquid_livestock_value_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  debtsOwedPkr: decimal('debts_owed_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  netZakatableWealthPkr: decimal('net_zakatable_wealth_pkr', { precision: 14, scale: 2 }).notNull(),
  zakatDuePkr: decimal('zakat_due_pkr', { precision: 14, scale: 2 }).notNull(),
  paidPkr: decimal('paid_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  paidTo: text('paid_to'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ntnStrnRecords = zameen.table('ntn_strn_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  ntn: text('ntn'),
  strn: text('strn'),
  fbrPrincipalActivity: text('fbr_principal_activity'),
  registrationDate: date('registration_date'),
  praRegistrationId: text('pra_registration_id'),
  cnicOfPrincipal: text('cnic_of_principal'),
  status: text('status').default('active'),
  notes: text('notes'),
});

export const TAX_KINDS = [
  'punjab_agri_income',
  'federal_income',
  'sales_tax',
  'zakat',
  'ushr',
  'wht_payroll',
  'wht_suppliers',
  'property_tax',
  'vehicle_token',
  'professional_tax',
  'other',
] as const;
export type TaxKind = (typeof TAX_KINDS)[number];

export const TAX_KIND_LABELS: Record<TaxKind, string> = {
  punjab_agri_income: 'Punjab Agri Income Tax',
  federal_income: 'Federal Income Tax',
  sales_tax: 'Sales Tax (FBR)',
  zakat: 'Zakat',
  ushr: 'Ushr',
  wht_payroll: 'WHT — Payroll',
  wht_suppliers: 'WHT — Suppliers',
  property_tax: 'Property Tax',
  vehicle_token: 'Vehicle Token Tax',
  professional_tax: 'Professional Tax',
  other: 'Other',
};
