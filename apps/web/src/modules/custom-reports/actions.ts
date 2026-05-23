'use server';
import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, customReports, scheduledReportDeliveries } from '@zameen/db';
import { executeReport } from '@zameen/finance';
import { REPORT_DATA_SOURCES } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

const filterSchema = z.object({
  column: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'between']),
  value: z.unknown(),
});
const aggSchema = z.object({
  column: z.string().min(1),
  fn: z.enum(['sum', 'avg', 'count', 'min', 'max']),
  alias: z.string().optional(),
});

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  nameUr: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(['private', 'team', 'entity', 'public']).default('private'),
  dataSource: z.string().refine((v) => REPORT_DATA_SOURCES.some((s) => s.id === v), 'unknown source'),
  filters: z.array(filterSchema).default([]),
  groupBy: z.array(z.string()).optional(),
  aggregations: z.array(aggSchema).min(1),
  sortBy: z.string().optional(),
  chartKind: z
    .enum(['table', 'bar', 'line', 'pie', 'area', 'heatmap', 'scatter', 'sankey', 'sunburst', 'radar', 'kpi_cards', 'map'])
    .optional(),
  chartConfig: z.record(z.unknown()).optional(),
  rowLimit: z.number().int().min(1).max(10_000).default(1000),
  refreshKind: z.enum(['on_open', 'manual', 'scheduled']).default('on_open'),
  scheduleCron: z.string().optional(),
});

type R = { ok: true; id: string } | { ok: false; error: string };

export async function saveCustomReport(raw: unknown): Promise<R> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  if (parsed.data.id) {
    await db
      .update(customReports)
      .set({
        name: parsed.data.name,
        nameUr: parsed.data.nameUr,
        description: parsed.data.description,
        visibility: parsed.data.visibility,
        dataSource: parsed.data.dataSource,
        filters: parsed.data.filters,
        groupBy: parsed.data.groupBy ?? null,
        aggregations: parsed.data.aggregations,
        sortBy: parsed.data.sortBy ?? null,
        chartKind: parsed.data.chartKind ?? null,
        chartConfig: parsed.data.chartConfig ?? null,
        rowLimit: parsed.data.rowLimit,
        refreshKind: parsed.data.refreshKind,
        scheduleCron: parsed.data.scheduleCron ?? null,
        updatedAt: new Date(),
      })
      .where(eq(customReports.id, parsed.data.id));
    revalidatePath('/reports');
    return { ok: true, id: parsed.data.id };
  }

  const [row] = await db
    .insert(customReports)
    .values({
      entityId: ctx.entityId,
      createdBy: ctx.userId,
      name: parsed.data.name,
      nameUr: parsed.data.nameUr,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      dataSource: parsed.data.dataSource,
      filters: parsed.data.filters,
      groupBy: parsed.data.groupBy ?? null,
      aggregations: parsed.data.aggregations,
      sortBy: parsed.data.sortBy ?? null,
      chartKind: parsed.data.chartKind ?? null,
      chartConfig: parsed.data.chartConfig ?? null,
      rowLimit: parsed.data.rowLimit,
      refreshKind: parsed.data.refreshKind,
      scheduleCron: parsed.data.scheduleCron ?? null,
    })
    .returning();
  revalidatePath('/reports');
  return { ok: true, id: row!.id };
}

export async function listCustomReports() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(customReports)
    .where(eq(customReports.entityId, ctx.entityId))
    .orderBy(desc(customReports.createdAt));
}

export async function getCustomReport(id: string) {
  const [row] = await db.select().from(customReports).where(eq(customReports.id, id)).limit(1);
  return row ?? null;
}

export async function runReport(id: string) {
  const ctx = await getSessionContext();
  return executeReport(id, ctx?.userId);
}

const scheduleSchema = z.object({
  reportId: z.string().uuid(),
  recipients: z
    .array(z.object({ kind: z.enum(['email', 'whatsapp', 'user']), value: z.string().min(1) }))
    .min(1),
  deliveryFormat: z.enum(['email_pdf', 'email_xlsx', 'whatsapp_summary', 'dashboard_embed']),
  scheduleCron: z.string().min(1),
});

export async function scheduleReport(raw: unknown): Promise<R> {
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const [row] = await db
    .insert(scheduledReportDeliveries)
    .values({
      reportId: parsed.data.reportId,
      recipients: parsed.data.recipients,
      deliveryFormat: parsed.data.deliveryFormat,
      scheduleCron: parsed.data.scheduleCron,
    })
    .returning();
  revalidatePath(`/reports/${parsed.data.reportId}`);
  return { ok: true, id: row!.id };
}
