'use server';
import { revalidatePath } from 'next/cache';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, customDashboards } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

const widgetSchema = z.object({
  id: z.string(),
  kind: z.enum(['report', 'kpi', 'note']),
  reportId: z.string().uuid().optional(),
  title: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
  config: z.record(z.unknown()).optional(),
});

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  visibility: z.enum(['private', 'team', 'entity', 'public']).default('private'),
  layout: z.array(widgetSchema),
  refreshSeconds: z.number().int().min(15).max(86_400).optional(),
});

type R = { ok: true; id: string } | { ok: false; error: string };

export async function saveCustomDashboard(raw: unknown): Promise<R> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  if (parsed.data.id) {
    await db
      .update(customDashboards)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        visibility: parsed.data.visibility,
        layout: parsed.data.layout,
        refreshSeconds: parsed.data.refreshSeconds ?? null,
      })
      .where(eq(customDashboards.id, parsed.data.id));
    revalidatePath(`/dashboards/${parsed.data.id}`);
    return { ok: true, id: parsed.data.id };
  }

  const [row] = await db
    .insert(customDashboards)
    .values({
      entityId: ctx.entityId,
      createdBy: ctx.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      layout: parsed.data.layout,
      refreshSeconds: parsed.data.refreshSeconds ?? null,
    })
    .returning();
  revalidatePath('/dashboards');
  return { ok: true, id: row!.id };
}

export async function listCustomDashboards() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(customDashboards)
    .where(eq(customDashboards.entityId, ctx.entityId))
    .orderBy(desc(customDashboards.createdAt));
}

export async function getCustomDashboard(id: string) {
  const [row] = await db.select().from(customDashboards).where(eq(customDashboards.id, id)).limit(1);
  return row ?? null;
}
