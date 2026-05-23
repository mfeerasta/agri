import { boolean, integer, jsonb, numeric, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';
import { waterSources } from './land.js';

export const warabandiSlots = zameen.table('warabandi_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  waterSourceId: uuid('water_source_id').notNull().references(() => waterSources.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  durationMinutes: integer('duration_minutes'),
  rotationWeeks: integer('rotation_weeks').notNull().default(1),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
});

export const irrigationEvents = zameen.table('irrigation_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  waterSourceId: uuid('water_source_id').notNull().references(() => waterSources.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  estimatedVolumeM3: numeric('estimated_volume_m3', { precision: 12, scale: 2 }),
  estimatedDepthMm: numeric('estimated_depth_mm', { precision: 6, scale: 2 }),
  dieselUsedLiters: numeric('diesel_used_liters', { precision: 8, scale: 2 }),
  dieselLogId: uuid('diesel_log_id'),
  method: text('method'),
  operatorId: uuid('operator_id'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  costPkr: numeric('cost_pkr', { precision: 14, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const irrigationSchedules = zameen.table('irrigation_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  warabandiSlotId: uuid('warabandi_slot_id').references(() => warabandiSlots.id, { onDelete: 'set null' }),
  waterSourceId: uuid('water_source_id').references(() => waterSources.id),
  expectedDurationMinutes: integer('expected_duration_minutes'),
  status: text('status').notNull().default('planned'),
  completedEventId: uuid('completed_event_id').references(() => irrigationEvents.id),
  reasonIfSkipped: text('reason_if_skipped'),
  createdBySystem: boolean('created_by_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
