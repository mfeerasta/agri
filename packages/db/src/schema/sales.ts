import { decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { produceLots } from './inventory.js';

export const buyers = zameen.table('buyers', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 24 }).notNull(),
  name: text('name').notNull(),
  category: varchar('category', { length: 24 }).notNull(),
  phone: varchar('phone', { length: 24 }),
  address: text('address'),
});

export const arhtis = zameen.table('arhtis', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  mandiLocation: text('mandi_location'),
  commissionPct: decimal('commission_pct', { precision: 5, scale: 3 }),
  phone: varchar('phone', { length: 24 }),
});

export const mandiDispatches = zameen.table('mandi_dispatches', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  dispatchNumber: varchar('dispatch_number', { length: 32 }).notNull(),
  produceLotId: uuid('produce_lot_id').references(() => produceLots.id),
  arhtiId: uuid('arhti_id').references(() => arhtis.id),
  dispatchedOn: date('dispatched_on').notNull(),
  vehicleNumber: varchar('vehicle_number', { length: 24 }),
  driverName: text('driver_name'),
  netWeightKg: decimal('net_weight_kg', { precision: 14, scale: 2 }).notNull(),
  bagsCount: decimal('bags_count', { precision: 8, scale: 0 }),
  freightPkr: decimal('freight_pkr', { precision: 12, scale: 2 }),
  status: varchar('status', { length: 16 }).notNull().default('dispatched'),
});

export const mandiSettlements = zameen.table('mandi_settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  mandiDispatchId: uuid('mandi_dispatch_id').notNull().references(() => mandiDispatches.id, { onDelete: 'cascade' }),
  settledOn: date('settled_on').notNull(),
  grossPricePkr: decimal('gross_price_pkr', { precision: 14, scale: 2 }).notNull(),
  commissionPkr: decimal('commission_pkr', { precision: 14, scale: 2 }).notNull(),
  loadingPkr: decimal('loading_pkr', { precision: 14, scale: 2 }),
  weighingPkr: decimal('weighing_pkr', { precision: 14, scale: 2 }),
  otherDeductionsPkr: decimal('other_deductions_pkr', { precision: 14, scale: 2 }),
  netReceivedPkr: decimal('net_received_pkr', { precision: 14, scale: 2 }).notNull(),
  pattiPhotoUrl: text('patti_photo_url'),
  approvalRequestId: uuid('approval_request_id'),
});

export const salesOrders = zameen.table('sales_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  soNumber: varchar('so_number', { length: 32 }).notNull().unique(),
  buyerId: uuid('buyer_id').notNull().references(() => buyers.id),
  soDate: date('so_date').notNull(),
  lines: jsonb('lines').notNull(),
  subtotalPkr: decimal('subtotal_pkr', { precision: 14, scale: 2 }).notNull(),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  approvalRequestId: uuid('approval_request_id'),
});

export const milkDispatches = zameen.table('milk_dispatches', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').notNull().references(() => buyers.id),
  dispatchedOn: date('dispatched_on').notNull(),
  session: varchar('session', { length: 8 }).notNull(),
  litres: decimal('litres', { precision: 10, scale: 2 }).notNull(),
  fatPct: decimal('fat_pct', { precision: 4, scale: 2 }),
  snfPct: decimal('snf_pct', { precision: 4, scale: 2 }),
  ratePerLitrePkr: decimal('rate_per_litre_pkr', { precision: 10, scale: 2 }),
  expectedAmountPkr: decimal('expected_amount_pkr', { precision: 14, scale: 2 }),
});

export const milkSettlements = zameen.table('milk_settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').notNull().references(() => buyers.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  totalLitres: decimal('total_litres', { precision: 14, scale: 2 }).notNull(),
  agreedAmountPkr: decimal('agreed_amount_pkr', { precision: 14, scale: 2 }).notNull(),
  deductionsPkr: decimal('deductions_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  netReceivedPkr: decimal('net_received_pkr', { precision: 14, scale: 2 }).notNull(),
  statementPhotoUrls: jsonb('statement_photo_urls').$type<string[]>().notNull().default([]),
  approvalRequestId: uuid('approval_request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
