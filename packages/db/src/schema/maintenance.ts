import { boolean, date, decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { assets } from './assets.js';

export type MaintenanceTriggerKind =
  | 'hour_meter'
  | 'days_elapsed'
  | 'km_traveled'
  | 'calendar_date'
  | 'condition_based';

export interface MaintenancePartRequired {
  name: string;
  partNumber?: string;
  quantity: number;
  unitCostPkr?: number;
}

export interface MaintenanceTaskTemplateStep {
  step: string;
  stepUr?: string;
  required: boolean;
}

export interface MaintenancePartUsed {
  name: string;
  partNumber?: string;
  quantity: number;
  unitCostPkr: number;
}

export const maintenancePlans = zameen.table('maintenance_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  triggerKind: text('trigger_kind').$type<MaintenanceTriggerKind>().notNull(),
  triggerValue: decimal('trigger_value', { precision: 12, scale: 2 }),
  cronExpression: text('cron_expression'),
  taskTemplate: jsonb('task_template').$type<MaintenanceTaskTemplateStep[]>().notNull(),
  partsRequired: jsonb('parts_required').$type<MaintenancePartRequired[]>().notNull().default([]),
  estimatedCostPkr: decimal('estimated_cost_pkr', { precision: 12, scale: 2 }),
  estimatedDowntimeHours: decimal('estimated_downtime_hours', { precision: 6, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  nextDueAt: timestamp('next_due_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const maintenanceExecutions = zameen.table('maintenance_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => maintenancePlans.id, { onDelete: 'set null' }),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  executedOn: date('executed_on').notNull(),
  executedBy: uuid('executed_by'),
  hourMeterAtService: decimal('hour_meter_at_service', { precision: 12, scale: 2 }),
  partsUsed: jsonb('parts_used').$type<MaintenancePartUsed[]>().notNull().default([]),
  laborHours: decimal('labor_hours', { precision: 6, scale: 2 }),
  partsCostPkr: decimal('parts_cost_pkr', { precision: 12, scale: 2 }),
  laborCostPkr: decimal('labor_cost_pkr', { precision: 12, scale: 2 }),
  externalServiceCostPkr: decimal('external_service_cost_pkr', { precision: 12, scale: 2 }),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  nextDueAt: timestamp('next_due_at', { withTimezone: true }),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  approvalRequestId: uuid('approval_request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
