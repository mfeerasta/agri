import { boolean, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

export type ReportVisibility = 'private' | 'team' | 'entity' | 'public';
export type ReportRefreshKind = 'on_open' | 'manual' | 'scheduled';
export type ReportChartKind =
  | 'table'
  | 'bar'
  | 'line'
  | 'pie'
  | 'area'
  | 'heatmap'
  | 'scatter'
  | 'sankey'
  | 'sunburst'
  | 'radar'
  | 'kpi_cards'
  | 'map';

export type ReportDeliveryFormat = 'email_pdf' | 'email_xlsx' | 'whatsapp_summary' | 'dashboard_embed';

export interface ReportFilter {
  column: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'between';
  value: unknown;
}

export interface ReportAggregation {
  column: string;
  fn: 'sum' | 'avg' | 'count' | 'min' | 'max';
  alias?: string;
}

export interface DashboardWidgetLayout {
  id: string;
  kind: 'report' | 'kpi' | 'note';
  reportId?: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

export const customReports = zameen.table('custom_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull(),
  createdBy: uuid('created_by').notNull(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  description: text('description'),
  visibility: text('visibility').$type<ReportVisibility>().notNull().default('private'),
  dataSource: text('data_source').notNull(),
  filters: jsonb('filters').$type<ReportFilter[]>().notNull().default([]),
  groupBy: text('group_by').array(),
  aggregations: jsonb('aggregations').$type<ReportAggregation[]>().notNull(),
  sortBy: text('sort_by'),
  chartKind: text('chart_kind').$type<ReportChartKind>(),
  chartConfig: jsonb('chart_config').$type<Record<string, unknown>>(),
  rowLimit: integer('row_limit').notNull().default(1000),
  refreshKind: text('refresh_kind').$type<ReportRefreshKind>().notNull().default('on_open'),
  scheduleCron: text('schedule_cron'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reportExecutions = zameen.table('report_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').notNull().references(() => customReports.id, { onDelete: 'cascade' }),
  executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
  executedBy: uuid('executed_by'),
  rowCount: integer('row_count'),
  durationMs: integer('duration_ms'),
  resultSnapshot: jsonb('result_snapshot').$type<unknown>(),
  exportedTo: text('exported_to'),
});

export const customDashboards = zameen.table('custom_dashboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull(),
  createdBy: uuid('created_by').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  visibility: text('visibility').$type<ReportVisibility>().notNull().default('private'),
  layout: jsonb('layout').$type<DashboardWidgetLayout[]>().notNull(),
  defaultFilters: jsonb('default_filters').$type<ReportFilter[]>(),
  refreshSeconds: integer('refresh_seconds'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scheduledReportDeliveries = zameen.table('scheduled_report_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').notNull().references(() => customReports.id, { onDelete: 'cascade' }),
  recipients: jsonb('recipients').$type<{ kind: 'email' | 'whatsapp' | 'user'; value: string }[]>().notNull(),
  deliveryFormat: text('delivery_format').$type<ReportDeliveryFormat>().notNull(),
  scheduleCron: text('schedule_cron').notNull(),
  lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
