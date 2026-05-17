'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, userDashboards } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

const widgetSchema = z.object({
  kind: z.enum([
    'stat',
    'line_chart',
    'bar_chart',
    'pie_chart',
    'task_count',
    'recent_activity',
    'field_map_mini',
    'approval_queue_preview',
    'cash_position',
  ]),
  title: z.string(),
  config: z.record(z.unknown()).default({}),
  gridPos: z.object({
    x: z.number().int().min(0).max(11),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(12),
  }),
});

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  widgets: z.array(widgetSchema),
  isDefault: z.boolean().default(true),
});

type R = { ok: true; id: string } | { ok: false; error: string };

export async function saveDashboard(raw: unknown): Promise<R> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  if (parsed.data.isDefault) {
    await db
      .update(userDashboards)
      .set({ isDefault: false })
      .where(and(eq(userDashboards.userId, ctx.userId), eq(userDashboards.entityId, ctx.entityId)));
  }

  if (parsed.data.id) {
    await db
      .update(userDashboards)
      .set({
        name: parsed.data.name,
        widgets: parsed.data.widgets,
        isDefault: parsed.data.isDefault,
      })
      .where(eq(userDashboards.id, parsed.data.id));
    revalidatePath('/dashboards');
    return { ok: true, id: parsed.data.id };
  }

  const [row] = await db
    .insert(userDashboards)
    .values({
      userId: ctx.userId,
      entityId: ctx.entityId,
      name: parsed.data.name,
      widgets: parsed.data.widgets,
      isDefault: parsed.data.isDefault,
    })
    .returning();
  revalidatePath('/dashboards');
  return { ok: true, id: row!.id };
}

export async function getDefaultDashboard() {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const [row] = await db
    .select()
    .from(userDashboards)
    .where(and(eq(userDashboards.userId, ctx.userId), eq(userDashboards.isDefault, true)))
    .limit(1);
  return row ?? null;
}

export async function listDashboards() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(userDashboards)
    .where(eq(userDashboards.userId, ctx.userId))
    .orderBy(desc(userDashboards.createdAt));
}
