import { boolean, decimal, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';
import { inputTypeEnum, produceGradeEnum } from './enums.js';

export const inputs = zameen.table('inputs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  type: inputTypeEnum('type').notNull(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  brand: text('brand'),
  unit: varchar('unit', { length: 16 }).notNull(),
  unitSizeKg: decimal('unit_size_kg', { precision: 10, scale: 4 }),
  defaultVendorId: uuid('default_vendor_id'),
  expiryTracked: boolean('expiry_tracked').notNull().default(false),
  reorderPoint: decimal('reorder_point', { precision: 12, scale: 4 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
});

export const inputPurchases = zameen.table('input_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  inputId: uuid('input_id').notNull().references(() => inputs.id),
  vendorId: uuid('vendor_id'),
  purchasedOn: timestamp('purchased_on', { withTimezone: true }).notNull(),
  quantity: decimal('quantity', { precision: 14, scale: 4 }).notNull(),
  unitPricePkr: decimal('unit_price_pkr', { precision: 14, scale: 2 }).notNull(),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 64 }),
  receiptPhotoUrls: jsonb('receipt_photo_urls').$type<string[]>().notNull().default([]),
  approvalRequestId: uuid('approval_request_id'),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  batchNumber: varchar('batch_number', { length: 64 }),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inputIssuances = zameen.table('input_issuances', {
  id: uuid('id').primaryKey().defaultRandom(),
  inputId: uuid('input_id').notNull().references(() => inputs.id),
  fieldId: uuid('field_id').references(() => fields.id),
  cropPlanId: uuid('crop_plan_id'),
  issuedOn: timestamp('issued_on', { withTimezone: true }).notNull(),
  quantity: decimal('quantity', { precision: 14, scale: 4 }).notNull(),
  unitCostPkr: decimal('unit_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  issuedTo: uuid('issued_to'),
  receivedBy: uuid('received_by'),
  purpose: text('purpose'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const storageLocations = zameen.table('storage_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  code: varchar('code', { length: 32 }).notNull(),
  name: text('name').notNull(),
  kind: varchar('kind', { length: 32 }).notNull(),
  capacityKg: decimal('capacity_kg', { precision: 14, scale: 2 }),
  location: jsonb('location'),
});

export const produceLots = zameen.table('produce_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  cropPlanId: uuid('crop_plan_id'),
  fieldId: uuid('field_id').references(() => fields.id),
  harvestRecordId: uuid('harvest_record_id'),
  lotNumber: varchar('lot_number', { length: 32 }).notNull(),
  cropName: text('crop_name').notNull(),
  grade: produceGradeEnum('grade').notNull().default('a'),
  moisturePct: decimal('moisture_pct', { precision: 5, scale: 2 }),
  netWeightKg: decimal('net_weight_kg', { precision: 14, scale: 2 }).notNull(),
  storageLocationId: uuid('storage_location_id').references(() => storageLocations.id),
  receivedOn: timestamp('received_on', { withTimezone: true }).notNull(),
  shrinkagePct: decimal('shrinkage_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  costOfGoodsPkr: decimal('cost_of_goods_pkr', { precision: 14, scale: 2 }),
  status: varchar('status', { length: 16 }).notNull().default('on_hand'),
});

export const produceMovements = zameen.table('produce_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  produceLotId: uuid('produce_lot_id').notNull().references(() => produceLots.id, { onDelete: 'cascade' }),
  fromLocationId: uuid('from_location_id').references(() => storageLocations.id),
  toLocationId: uuid('to_location_id').references(() => storageLocations.id),
  quantityKg: decimal('quantity_kg', { precision: 14, scale: 2 }).notNull(),
  movedOn: timestamp('moved_on', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
  movedBy: uuid('moved_by'),
});
