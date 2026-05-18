'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import { db, entities } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { seedDemoData } from './seed-demo-runner';

/**
 * Load 60 days of fake history so dashboards have something to show before
 * pilot launch. All rows are tagged is_demo = true so clearDemoData can
 * remove them in one shot per table.
 */
export async function loadDemoData(entityId: string): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  try {
    await db.update(entities).set({ isDemo: true }).where(eq(entities.id, entityId));
    const counts = await seedDemoData(entityId, ctx.userId);
    revalidatePath('/app');
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Wipe every demo-tagged row for an entity. Each DELETE is scoped to the
 * entity and gated by is_demo = true. Production rows are never touched.
 */
export async function clearDemoData(entityId: string): Promise<{ ok: true; rowsDeleted: number } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const tables = [
    'diesel_purchases',
    'diesel_daily_logs',
    'repair_requests',
    'harvest_records',
    'attendance_records',
    'task_completions',
    'milk_records',
    'cost_allocations',
    'journal_entries',
    'approval_requests',
  ];

  try {
    let total = 0;
    for (const t of tables) {
      const res = await db.execute(
        drizzleSql.raw(`delete from zameen.${t} where is_demo = true and entity_id = '${entityId}'`),
      );
      const rowCount = (res as unknown as { count?: number; rowCount?: number }).count
        ?? (res as unknown as { rowCount?: number }).rowCount
        ?? 0;
      total += Number(rowCount);
    }
    await db.update(entities).set({ isDemo: false }).where(eq(entities.id, entityId));
    revalidatePath('/app');
    return { ok: true, rowsDeleted: total };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
