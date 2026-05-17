import { boolean, decimal, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { assets } from './assets.js';
import { repairSeverityEnum, repairStatusEnum } from './enums.js';

export const repairRequests = zameen.table('repair_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'restrict' }),
  requestNumber: varchar('request_number', { length: 32 }).notNull().unique(),
  reportedBy: uuid('reported_by'),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
  issueDescription: text('issue_description').notNull(),
  issueDescriptionUr: text('issue_description_ur'),
  severity: repairSeverityEnum('severity').notNull().default('minor'),
  suggestedAction: text('suggested_action'),
  problemPhotoUrls: jsonb('problem_photo_urls').$type<string[]>().notNull().default([]),
  status: repairStatusEnum('status').notNull().default('reported'),
  approvalRequestId: uuid('approval_request_id'),
  selectedQuoteId: uuid('selected_quote_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repairQuotes = zameen.table('repair_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  repairRequestId: uuid('repair_request_id')
    .notNull()
    .references(() => repairRequests.id, { onDelete: 'cascade' }),
  workshopName: text('workshop_name').notNull(),
  workshopContact: text('workshop_contact'),
  workshopLocation: text('workshop_location'),
  partsList: jsonb('parts_list').$type<Array<{ name: string; qty: number; unitPricePkr: number }>>().notNull().default([]),
  partsTotalPkr: decimal('parts_total_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  laborTotalPkr: decimal('labor_total_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  totalQuotePkr: decimal('total_quote_pkr', { precision: 14, scale: 2 }).notNull(),
  etaDays: decimal('eta_days', { precision: 6, scale: 2 }),
  warrantyDays: decimal('warranty_days', { precision: 6, scale: 0 }),
  quoteDocumentUrls: jsonb('quote_document_urls').$type<string[]>().notNull().default([]),
  ocrExtractedText: text('ocr_extracted_text'),
  selected: boolean('selected').notNull().default(false),
  selectionReason: text('selection_reason'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repairWorkOrders = zameen.table('repair_work_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  repairRequestId: uuid('repair_request_id')
    .notNull()
    .references(() => repairRequests.id, { onDelete: 'cascade' }),
  selectedQuoteId: uuid('selected_quote_id').notNull().references(() => repairQuotes.id),
  woNumber: varchar('wo_number', { length: 32 }).notNull().unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expectedCompletionAt: timestamp('expected_completion_at', { withTimezone: true }),
  actualCompletionAt: timestamp('actual_completion_at', { withTimezone: true }),
  finalInvoicePkr: decimal('final_invoice_pkr', { precision: 14, scale: 2 }),
  finalInvoicePhotoUrls: jsonb('final_invoice_photo_urls').$type<string[]>().notNull().default([]),
  variancePkr: decimal('variance_pkr', { precision: 14, scale: 2 }),
  reapprovalRequestId: uuid('reapproval_request_id'),
  operatorSignoffPhotoUrl: text('operator_signoff_photo_url'),
  operatorSignoffBy: uuid('operator_signoff_by'),
  warrantyStart: timestamp('warranty_start', { withTimezone: true }),
  warrantyEnd: timestamp('warranty_end', { withTimezone: true }),
  notes: text('notes'),
});

export const partsReplaced = zameen.table('parts_replaced', {
  id: uuid('id').primaryKey().defaultRandom(),
  workOrderId: uuid('work_order_id').notNull().references(() => repairWorkOrders.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id),
  partName: text('part_name').notNull(),
  partNumber: varchar('part_number', { length: 64 }),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).notNull(),
  unitCostPkr: decimal('unit_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  warrantyDays: decimal('warranty_days', { precision: 6, scale: 0 }),
});
