import { decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { assets } from './assets.js';
import { fields } from './land.js';
import { paymentMethodEnum } from './enums.js';

export const fuelStorageTanks = zameen.table('fuel_storage_tanks', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: text('name').notNull(),
  capacityLiters: decimal('capacity_liters', { precision: 12, scale: 2 }).notNull(),
  currentStockLiters: decimal('current_stock_liters', { precision: 12, scale: 2 }).notNull().default('0'),
  location: jsonb('location'),
});

export const dieselPurchases = zameen.table('diesel_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull(),
  vendorName: text('vendor_name').notNull(),
  vendorLocation: text('vendor_location'),
  quantityLiters: decimal('quantity_liters', { precision: 12, scale: 2 }).notNull(),
  rateLiterPkr: decimal('rate_liter_pkr', { precision: 10, scale: 2 }).notNull(),
  totalPkr: decimal('total_pkr', { precision: 14, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
  paidImmediately: timestamp('paid_immediately', { withTimezone: true }),
  filledToTankId: uuid('filled_to_tank_id').references(() => fuelStorageTanks.id),
  filledDirectlyToAssetId: uuid('filled_directly_to_asset_id').references(() => assets.id),
  receiptPhotoUrls: jsonb('receipt_photo_urls').$type<string[]>().notNull().default([]),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dieselDailyLogs = zameen.table('diesel_daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'restrict' }),
  logDate: date('log_date').notNull(),
  operatorId: uuid('operator_id'),
  operatorName: text('operator_name'),
  hourMeterStart: decimal('hour_meter_start', { precision: 12, scale: 2 }).notNull(),
  hourMeterEnd: decimal('hour_meter_end', { precision: 12, scale: 2 }).notNull(),
  hoursRun: decimal('hours_run', { precision: 8, scale: 2 }).notNull(),
  dieselFilledLiters: decimal('diesel_filled_liters', { precision: 10, scale: 2 }).notNull(),
  rateLiterPkr: decimal('rate_liter_pkr', { precision: 10, scale: 2 }).notNull(),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  sourceTankId: uuid('source_tank_id').references(() => fuelStorageTanks.id),
  taskFieldId: uuid('task_field_id').references(() => fields.id),
  taskKind: varchar('task_kind', { length: 32 }),
  taskNotes: text('task_notes'),
  receiptPhotoUrls: jsonb('receipt_photo_urls').$type<string[]>().notNull().default([]),
  idleHours: decimal('idle_hours', { precision: 6, scale: 2 }),
  breakdownHours: decimal('breakdown_hours', { precision: 6, scale: 2 }),
  anomalyFlag: text('anomaly_flag'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dieselStockReconciliations = zameen.table('diesel_stock_reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tankId: uuid('tank_id').notNull().references(() => fuelStorageTanks.id, { onDelete: 'cascade' }),
  reconciledOn: date('reconciled_on').notNull(),
  openingStockLiters: decimal('opening_stock_liters', { precision: 12, scale: 2 }).notNull(),
  purchasesInLiters: decimal('purchases_in_liters', { precision: 12, scale: 2 }).notNull(),
  issuancesOutLiters: decimal('issuances_out_liters', { precision: 12, scale: 2 }).notNull(),
  expectedClosingLiters: decimal('expected_closing_liters', { precision: 12, scale: 2 }).notNull(),
  actualClosingLiters: decimal('actual_closing_liters', { precision: 12, scale: 2 }).notNull(),
  varianceLiters: decimal('variance_liters', { precision: 10, scale: 2 }).notNull(),
  variancePct: decimal('variance_pct', { precision: 6, scale: 3 }),
  withinTolerance: text('within_tolerance').notNull().default('true'),
  physicalCheckPhotoUrls: jsonb('physical_check_photo_urls').$type<string[]>().notNull().default([]),
  reconciledBy: uuid('reconciled_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
