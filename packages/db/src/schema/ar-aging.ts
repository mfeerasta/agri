import { boolean, date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const arInvoices = zameen.table('ar_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date').notNull(),
  salesDispatchId: uuid('sales_dispatch_id'),
  deliveryId: uuid('delivery_id'),
  forwardContractId: uuid('forward_contract_id'),
  description: text('description'),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  taxPkr: decimal('tax_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  discountPkr: decimal('discount_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  paidPkr: decimal('paid_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  outstandingPkr: decimal('outstanding_pkr', { precision: 14, scale: 2 }).notNull(),
  status: text('status').notNull().default('open'),
  paymentTermsDays: integer('payment_terms_days'),
  invoicePdfUrl: text('invoice_pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const arReceipts = zameen.table('ar_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => arInvoices.id, { onDelete: 'cascade' }),
  receivedOn: date('received_on').notNull(),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  method: text('method').notNull(),
  referenceNumber: text('reference_number'),
  bankName: text('bank_name'),
  clearedOn: date('cleared_on'),
  journalEntryId: uuid('journal_entry_id'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const buyerCreditLimits = zameen.table('buyer_credit_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: uuid('buyer_id').notNull(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  creditLimitPkr: decimal('credit_limit_pkr', { precision: 14, scale: 2 }).notNull(),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  earlyPaymentDiscountPct: decimal('early_payment_discount_pct', { precision: 5, scale: 2 }),
  lateFeePctPerMonth: decimal('late_fee_pct_per_month', { precision: 5, scale: 2 }),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  approvedBy: uuid('approved_by'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const arDisputes = zameen.table('ar_disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => arInvoices.id, { onDelete: 'cascade' }),
  raisedOn: date('raised_on').notNull(),
  raisedByBuyer: text('raised_by_buyer'),
  disputeKind: text('dispute_kind'),
  disputedAmountPkr: decimal('disputed_amount_pkr', { precision: 14, scale: 2 }),
  description: text('description'),
  evidenceUrls: jsonb('evidence_urls').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('open'),
  resolution: text('resolution'),
  resolutionAmountPkr: decimal('resolution_amount_pkr', { precision: 14, scale: 2 }),
  resolvedOn: date('resolved_on'),
  resolvedBy: uuid('resolved_by'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
