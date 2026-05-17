import { date, decimal, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';
import { assets } from './assets.js';
import { dieselDailyLogs } from './diesel.js';

export const dieselAnomalies = zameen.table('diesel_anomalies', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  dieselDailyLogId: uuid('diesel_daily_log_id').references(() => dieselDailyLogs.id, { onDelete: 'cascade' }),
  detectedOn: date('detected_on').notNull(),
  rolling30dAvgLph: decimal('rolling_30d_avg_lph', { precision: 10, scale: 3 }).notNull(),
  observedLph: decimal('observed_lph', { precision: 10, scale: 3 }).notNull(),
  deviationPct: decimal('deviation_pct', { precision: 6, scale: 2 }).notNull(),
  severity: text('severity').notNull().default('warning'),
  status: text('status').notNull().default('open'),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DieselAnomalySeverity = 'warning' | 'high' | 'critical';
export type DieselAnomalyStatus = 'open' | 'acknowledged' | 'dismissed' | 'resolved';
