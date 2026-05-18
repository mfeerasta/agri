import { date, decimal, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { journalEntries } from './finance.js';

export const cropLoans = zameen.table('crop_loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  lenderKind: text('lender_kind').notNull(),
  lenderName: text('lender_name').notNull(),
  loanNumber: text('loan_number'),
  principalPkr: decimal('principal_pkr', { precision: 14, scale: 2 }).notNull(),
  interestRatePct: decimal('interest_rate_pct', { precision: 5, scale: 3 }),
  disbursementDate: date('disbursement_date').notNull(),
  maturityDate: date('maturity_date'),
  collateralKind: text('collateral_kind'),
  collateralDetails: text('collateral_details'),
  purpose: text('purpose'),
  status: text('status').notNull().default('pending'),
  approvalRequestId: uuid('approval_request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cropLoanTransactions = zameen.table('crop_loan_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => cropLoans.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  occurredOn: date('occurred_on').notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
