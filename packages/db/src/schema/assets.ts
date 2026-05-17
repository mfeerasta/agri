import { boolean, decimal, jsonb, text, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { assetCategoryEnum } from './enums.js';

export const assets = zameen.table('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  category: assetCategoryEnum('category').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  registrationNumber: varchar('registration_number', { length: 32 }),
  engineNumber: varchar('engine_number', { length: 64 }),
  chassisNumber: varchar('chassis_number', { length: 64 }),
  purchaseDate: timestamp('purchase_date', { withTimezone: true }),
  purchasePricePkr: decimal('purchase_price_pkr', { precision: 14, scale: 2 }),
  currentBookValuePkr: decimal('current_book_value_pkr', { precision: 14, scale: 2 }),
  depreciationMethod: varchar('depreciation_method', { length: 32 }),
  usefulLifeYears: integer('useful_life_years'),
  manufacturerFuelSpecLph: decimal('manufacturer_fuel_spec_lph', { precision: 6, scale: 2 }),
  rolling30dAvgLph: decimal('rolling_30d_avg_lph', { precision: 6, scale: 2 }),
  currentHourMeter: decimal('current_hour_meter', { precision: 12, scale: 2 }).notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const assetHourMeters = zameen.table('asset_hour_meters', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  recordedOn: timestamp('recorded_on', { withTimezone: true }).notNull(),
  meterReading: decimal('meter_reading', { precision: 12, scale: 2 }).notNull(),
  recordedBy: uuid('recorded_by'),
  source: varchar('source', { length: 32 }).notNull().default('manual'),
});

export const assetLogs = zameen.table('asset_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 32 }).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  details: jsonb('details'),
  createdBy: uuid('created_by'),
});
