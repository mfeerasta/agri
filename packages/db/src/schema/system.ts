import { boolean, decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';

export const auditLog = zameen.table('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
  actorId: uuid('actor_id').references(() => users.id),
  actorRole: varchar('actor_role', { length: 24 }),
  action: varchar('action', { length: 64 }).notNull(),
  resource: varchar('resource', { length: 64 }).notNull(),
  resourceId: uuid('resource_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  gpsLocation: jsonb('gps_location'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = zameen.table('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').references(() => entities.id),
  channel: varchar('channel', { length: 16 }).notNull(),
  category: varchar('category', { length: 32 }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  bodyUr: text('body_ur'),
  deepLink: text('deep_link'),
  payload: jsonb('payload'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  failedReason: text('failed_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const weatherRecords = zameen.table('weather_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  recordedFor: date('recorded_for').notNull(),
  source: varchar('source', { length: 16 }).notNull(),
  minTempC: decimal('min_temp_c', { precision: 5, scale: 2 }),
  maxTempC: decimal('max_temp_c', { precision: 5, scale: 2 }),
  rainfallMm: decimal('rainfall_mm', { precision: 6, scale: 2 }),
  humidityPct: decimal('humidity_pct', { precision: 5, scale: 2 }),
  windKph: decimal('wind_kph', { precision: 6, scale: 2 }),
  forecastPayload: jsonb('forecast_payload'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

export const marketPrices = zameen.table('market_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  commodity: varchar('commodity', { length: 32 }).notNull(),
  market: varchar('market', { length: 64 }).notNull(),
  recordedOn: date('recorded_on').notNull(),
  unit: varchar('unit', { length: 16 }).notNull(),
  minPkr: decimal('min_pkr', { precision: 12, scale: 2 }),
  maxPkr: decimal('max_pkr', { precision: 12, scale: 2 }),
  modePkr: decimal('mode_pkr', { precision: 12, scale: 2 }),
  source: varchar('source', { length: 32 }),
});

export const offlineSyncQueue = zameen.table('offline_sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  deviceId: varchar('device_id', { length: 64 }),
  resource: varchar('resource', { length: 64 }).notNull(),
  operation: varchar('operation', { length: 16 }).notNull(),
  payload: jsonb('payload').notNull(),
  clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  appliedSuccess: boolean('applied_success'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
