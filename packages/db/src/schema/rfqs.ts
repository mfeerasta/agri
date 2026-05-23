import { boolean, date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';
import { vendors, purchaseOrders } from './procurement.js';

export const rfqs = zameen.table('rfqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  rfqNumber: text('rfq_number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  neededBy: date('needed_by'),
  fieldId: uuid('field_id').references(() => fields.id),
  cropPlanId: uuid('crop_plan_id'),
  budgetEstimatePkr: decimal('budget_estimate_pkr', { precision: 14, scale: 2 }),
  status: text('status').notNull().default('draft'),
  selectedQuoteId: uuid('selected_quote_id'),
  selectionReason: text('selection_reason'),
  approvalRequestId: uuid('approval_request_id'),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rfqLineItems = zameen.table('rfq_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 14, scale: 4 }).notNull(),
  unit: text('unit').notNull(),
  specifications: jsonb('specifications'),
  orderIndex: integer('order_index').notNull().default(0),
});

export const rfqInvitations = zameen.table('rfq_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  declinedReason: text('declined_reason'),
  replyToken: text('reply_token').unique(),
});

export const rfqQuotes = zameen.table('rfq_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  quotedOn: timestamp('quoted_on', { withTimezone: true }).notNull().defaultNow(),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  paymentTerms: text('payment_terms'),
  deliveryLeadDays: integer('delivery_lead_days'),
  validityDays: integer('validity_days'),
  notes: text('notes'),
  quoteDocUrl: text('quote_doc_url'),
  linePrices: jsonb('line_prices')
    .$type<Array<{ lineItemId: string; unitPricePkr: number; notes?: string }>>()
    .notNull()
    .default([]),
  isWinner: boolean('is_winner').notNull().default(false),
});
