import { boolean, decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';
import { cropPlans } from './crops.js';
import { assets } from './assets.js';

export const accounts = zameen.table('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 16 }).notNull(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  accountType: varchar('account_type', { length: 24 }).notNull(),
  parentAccountId: uuid('parent_account_id'),
  isControl: boolean('is_control').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  costPool: varchar('cost_pool', { length: 32 }),
});

export const journalEntries = zameen.table('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  journalNumber: varchar('journal_number', { length: 24 }).notNull(),
  postedOn: date('posted_on').notNull(),
  narration: text('narration').notNull(),
  sourceModule: varchar('source_module', { length: 32 }),
  sourceRecordId: uuid('source_record_id'),
  approvalRequestId: uuid('approval_request_id'),
  totalDebitPkr: decimal('total_debit_pkr', { precision: 16, scale: 2 }).notNull(),
  totalCreditPkr: decimal('total_credit_pkr', { precision: 16, scale: 2 }).notNull(),
  postedBy: uuid('posted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  reversedById: uuid('reversed_by_id'),
});

export const journalLines = zameen.table('journal_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  debitPkr: decimal('debit_pkr', { precision: 16, scale: 2 }).notNull().default('0'),
  creditPkr: decimal('credit_pkr', { precision: 16, scale: 2 }).notNull().default('0'),
  fieldId: uuid('field_id').references(() => fields.id),
  cropPlanId: uuid('crop_plan_id').references(() => cropPlans.id),
  assetId: uuid('asset_id').references(() => assets.id),
  costPool: varchar('cost_pool', { length: 32 }),
  narration: text('narration'),
});

export const costAllocations = zameen.table('cost_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  sourceModule: varchar('source_module', { length: 32 }).notNull(),
  sourceRecordId: uuid('source_record_id').notNull(),
  fieldId: uuid('field_id').references(() => fields.id),
  cropPlanId: uuid('crop_plan_id').references(() => cropPlans.id),
  assetId: uuid('asset_id').references(() => assets.id),
  costPool: varchar('cost_pool', { length: 32 }).notNull(),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  allocatedOn: date('allocated_on').notNull(),
  allocationKey: varchar('allocation_key', { length: 32 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cashFlowForecasts = zameen.table('cash_flow_forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  generatedOn: date('generated_on').notNull(),
  horizonDays: decimal('horizon_days', { precision: 4, scale: 0 }).notNull().default('90'),
  rows: jsonb('rows').notNull(),
  cashGapWarnings: jsonb('cash_gap_warnings'),
  generatedBy: uuid('generated_by'),
});
