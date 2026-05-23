import { boolean, date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { inputs } from './inventory.js';

export const inventoryForecasts = zameen.table('inventory_forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  inputId: uuid('input_id').notNull().references(() => inputs.id, { onDelete: 'cascade' }),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  currentStock: decimal('current_stock', { precision: 14, scale: 4 }).notNull(),
  dailyVelocity: decimal('daily_velocity', { precision: 12, scale: 4 }).notNull(),
  stdDev: decimal('std_dev', { precision: 12, scale: 4 }),
  daysUntilStockout: integer('days_until_stockout'),
  recommendedReorderQuantity: decimal('recommended_reorder_quantity', { precision: 14, scale: 4 }),
  recommendedReorderByDate: date('recommended_reorder_by_date'),
  forecastHorizonDays: integer('forecast_horizon_days').notNull().default(90),
  forecastPayload: jsonb('forecast_payload').notNull(),
});

export const reorderRules = zameen.table('reorder_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  inputId: uuid('input_id').notNull().references(() => inputs.id, { onDelete: 'cascade' }),
  ruleKind: text('rule_kind').notNull(),
  reorderPoint: decimal('reorder_point', { precision: 14, scale: 4 }),
  reorderQuantity: decimal('reorder_quantity', { precision: 14, scale: 4 }),
  reviewPeriodDays: integer('review_period_days'),
  safetyStockDays: integer('safety_stock_days').notNull().default(7),
  preferredVendorId: uuid('preferred_vendor_id'),
  autoCreateRfq: boolean('auto_create_rfq').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryAnomalies = zameen.table('inventory_anomalies', {
  id: uuid('id').primaryKey().defaultRandom(),
  inputId: uuid('input_id').notNull().references(() => inputs.id, { onDelete: 'cascade' }),
  detectedOn: date('detected_on').notNull(),
  observedQuantity: decimal('observed_quantity', { precision: 14, scale: 4 }).notNull(),
  expectedQuantity: decimal('expected_quantity', { precision: 14, scale: 4 }).notNull(),
  stdDevAway: decimal('std_dev_away', { precision: 6, scale: 2 }).notNull(),
  anomalyKind: text('anomaly_kind').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ReorderRuleKind = 'reorder_point' | 'periodic' | 'eoq' | 'manual';
export type InventoryAnomalyKind =
  | 'unusual_high_usage'
  | 'unusual_low_usage'
  | 'stockout'
  | 'expired_unused'
  | 'batch_mismatch'
  | 'reconciliation_variance';
