import { boolean, date, decimal, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { insurancePolicies } from './insurance.js';

export const weatherIndexTriggers = zameen.table('weather_index_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => insurancePolicies.id, { onDelete: 'cascade' }),
  triggerKind: text('trigger_kind').notNull(),
  thresholdValue: decimal('threshold_value', { precision: 10, scale: 3 }).notNull(),
  measurementWindowDays: integer('measurement_window_days').notNull().default(7),
  payoutPerUnitPkr: decimal('payout_per_unit_pkr', { precision: 14, scale: 2 }),
  maxPayoutPkr: decimal('max_payout_pkr', { precision: 14, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const weatherIndexEvaluations = zameen.table('weather_index_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  triggerId: uuid('trigger_id').notNull().references(() => weatherIndexTriggers.id, { onDelete: 'cascade' }),
  evaluatedOn: date('evaluated_on').notNull(),
  measuredValue: decimal('measured_value', { precision: 10, scale: 3 }).notNull(),
  thresholdValue: decimal('threshold_value', { precision: 10, scale: 3 }).notNull(),
  isTriggered: boolean('is_triggered').notNull(),
  computedPayoutPkr: decimal('computed_payout_pkr', { precision: 14, scale: 2 }),
  claimDraftId: uuid('claim_draft_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WeatherIndexTriggerKind =
  | 'frost_hours'
  | 'heat_days'
  | 'rainfall_deficit'
  | 'rainfall_excess'
  | 'wind_speed'
  | 'ndvi_below'
  | 'soil_moisture_below'
  | 'locust_within_km';
