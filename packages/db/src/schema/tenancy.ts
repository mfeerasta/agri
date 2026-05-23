import { date, decimal, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

// Lease contracts cover Punjab tenure spectrum: owned, rented in/out, sharecrop
// (battai), musharka (partnership). One contract per field per active period.
export const leaseContracts = zameen.table('lease_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  counterpartyName: text('counterparty_name').notNull(),
  counterpartyCnic: text('counterparty_cnic'),
  counterpartyPhone: text('counterparty_phone'),
  tenure: varchar('tenure', { length: 24 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  annualRentPkr: decimal('annual_rent_pkr', { precision: 14, scale: 2 }),
  rentPaymentSchedule: varchar('rent_payment_schedule', { length: 16 }),
  sharePctLandowner: decimal('share_pct_landowner', { precision: 5, scale: 2 }),
  sharePctTenant: decimal('share_pct_tenant', { precision: 5, scale: 2 }),
  inputShareArrangement: jsonb('input_share_arrangement'),
  deedDocUrl: text('deed_doc_url'),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leasePayments = zameen.table('lease_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id').notNull().references(() => leaseContracts.id, { onDelete: 'cascade' }),
  paidOn: date('paid_on').notNull(),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 24 }).notNull(),
  referenceNumber: text('reference_number'),
  receiptUrl: text('receipt_url'),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  approvalRequestId: uuid('approval_request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sharecropSettlements = zameen.table('sharecrop_settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaseId: uuid('lease_id').notNull().references(() => leaseContracts.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id'),
  harvestRecordId: uuid('harvest_record_id'),
  settledOn: date('settled_on').notNull(),
  grossProduceKg: decimal('gross_produce_kg', { precision: 14, scale: 2 }).notNull(),
  grossRevenuePkr: decimal('gross_revenue_pkr', { precision: 14, scale: 2 }).notNull(),
  deductionsPkr: decimal('deductions_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  landownerSharePkr: decimal('landowner_share_pkr', { precision: 14, scale: 2 }).notNull(),
  tenantSharePkr: decimal('tenant_share_pkr', { precision: 14, scale: 2 }).notNull(),
  paidToLandownerOn: date('paid_to_landowner_on'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LeaseTenure =
  | 'owned'
  | 'rented_in'
  | 'rented_out'
  | 'sharecrop_in'
  | 'sharecrop_out'
  | 'musharka'
  | 'other';

export const LEASE_TENURES: readonly LeaseTenure[] = [
  'owned',
  'rented_in',
  'rented_out',
  'sharecrop_in',
  'sharecrop_out',
  'musharka',
  'other',
] as const;

export type LeaseStatus = 'active' | 'expired' | 'terminated' | 'disputed';
export type RentSchedule = 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'seasonal';
