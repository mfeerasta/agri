import { boolean, decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const vendors = zameen.table('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 24 }).notNull(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  category: varchar('category', { length: 32 }),
  phone: varchar('phone', { length: 24 }),
  address: text('address'),
  ntn: varchar('ntn', { length: 32 }),
  creditTermsDays: decimal('credit_terms_days', { precision: 4, scale: 0 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
});

export const purchaseOrders = zameen.table('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  poNumber: varchar('po_number', { length: 32 }).notNull().unique(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  poDate: date('po_date').notNull(),
  expectedDeliveryDate: date('expected_delivery_date'),
  lines: jsonb('lines').notNull(),
  subtotalPkr: decimal('subtotal_pkr', { precision: 14, scale: 2 }).notNull(),
  taxPkr: decimal('tax_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  approvalRequestId: uuid('approval_request_id'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const goodsReceivedNotes = zameen.table('goods_received_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id),
  grnNumber: varchar('grn_number', { length: 32 }).notNull().unique(),
  receivedOn: date('received_on').notNull(),
  receivedBy: uuid('received_by'),
  lines: jsonb('lines').notNull(),
  qualityCheckPassed: boolean('quality_check_passed').notNull().default(true),
  qcNotes: text('qc_notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseInvoices = zameen.table('purchase_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date'),
  subtotalPkr: decimal('subtotal_pkr', { precision: 14, scale: 2 }).notNull(),
  taxPkr: decimal('tax_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  paidPkr: decimal('paid_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  invoicePhotoUrls: jsonb('invoice_photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
