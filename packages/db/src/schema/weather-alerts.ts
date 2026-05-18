import { boolean, date, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { tasks } from './labor.js';

export const weatherAlertRules = zameen.table('weather_alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  conditionKind: text('condition_kind').notNull(),
  threshold: jsonb('threshold').notNull(),
  actionKind: text('action_kind').notNull(),
  actionConfig: jsonb('action_config').notNull().default({}),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  fireCount: integer('fire_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const weatherAlerts = zameen.table('weather_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleId: uuid('rule_id').notNull().references(() => weatherAlertRules.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  triggeredOn: date('triggered_on').notNull(),
  observation: jsonb('observation').notNull(),
  taskId: uuid('task_id').references(() => tasks.id),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WeatherAlertConditionKind =
  | 'frost_warning'
  | 'heatwave'
  | 'heavy_rain'
  | 'strong_wind'
  | 'low_humidity'
  | 'drought_days';

export type WeatherAlertActionKind =
  | 'create_task'
  | 'notify_supervisor'
  | 'flag_field'
  | 'suspend_spraying';

export interface WeatherAlertThreshold {
  minTempC?: number;
  maxTempC?: number;
  rainfallMm?: number;
  windKph?: number;
  humidityPct?: number;
  consecutiveDays?: number;
}
