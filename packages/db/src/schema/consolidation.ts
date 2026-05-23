import { date, jsonb, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const entityRelationships = zameen.table('entity_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentEntityId: uuid('parent_entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  childEntityId: uuid('child_entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  ownershipPct: numeric('ownership_pct', { precision: 5, scale: 2 }).notNull().default('100'),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  consolidationMethod: text('consolidation_method').notNull().default('full'),
});

export const intercompanyTransactions = zameen.table('intercompany_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromEntityId: uuid('from_entity_id').notNull().references(() => entities.id),
  toEntityId: uuid('to_entity_id').notNull().references(() => entities.id),
  transactionDate: date('transaction_date').notNull(),
  description: text('description').notNull(),
  amountPkr: numeric('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  kind: text('kind'),
  fromJournalEntryId: uuid('from_journal_entry_id'),
  toJournalEntryId: uuid('to_journal_entry_id'),
  eliminationStatus: text('elimination_status').notNull().default('pending'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const consolidationRuns = zameen.table('consolidation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentEntityId: uuid('parent_entity_id').notNull().references(() => entities.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  consolidatedAt: timestamp('consolidated_at', { withTimezone: true }).notNull().defaultNow(),
  consolidatedBy: uuid('consolidated_by'),
  balanceSheetSnapshot: jsonb('balance_sheet_snapshot'),
  incomeStatementSnapshot: jsonb('income_statement_snapshot'),
  cashFlowSnapshot: jsonb('cash_flow_snapshot'),
  eliminationsApplied: jsonb('eliminations_applied').notNull().default([]),
  childEntities: jsonb('child_entities').notNull().default([]),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
});

export type EntityRelationship = typeof entityRelationships.$inferSelect;
export type IntercompanyTransaction = typeof intercompanyTransactions.$inferSelect;
export type ConsolidationRun = typeof consolidationRuns.$inferSelect;
