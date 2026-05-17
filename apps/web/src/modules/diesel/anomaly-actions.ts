'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, dieselAnomalies, entityActivity } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

async function logActivity(anomalyId: string, actorId: string | null, verb: string, payload: Record<string, unknown>) {
  await db.insert(entityActivity).values({
    entityKind: 'diesel_anomaly',
    entityId: anomalyId,
    actorId,
    verb,
    payload,
  });
}

export async function acknowledgeAnomaly(id: string): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(dieselAnomalies)
    .set({ status: 'acknowledged', acknowledgedBy: ctx.userId, acknowledgedAt: new Date() })
    .where(eq(dieselAnomalies.id, id));
  await logActivity(id, ctx.userId, 'acknowledged_anomaly', {});
  revalidatePath('/diesel/anomalies');
  return { ok: true, id };
}

export async function dismissAnomaly(id: string, reason: string): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!reason.trim()) return { ok: false, error: 'Dismissal reason required' };
  await db
    .update(dieselAnomalies)
    .set({
      status: 'dismissed',
      acknowledgedBy: ctx.userId,
      acknowledgedAt: new Date(),
      resolutionNotes: reason,
    })
    .where(eq(dieselAnomalies.id, id));
  await logActivity(id, ctx.userId, 'dismissed_anomaly', { reason });
  revalidatePath('/diesel/anomalies');
  return { ok: true, id };
}

export async function resolveAnomaly(id: string, notes: string): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!notes.trim()) return { ok: false, error: 'Resolution notes required' };
  await db
    .update(dieselAnomalies)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      resolutionNotes: notes,
      acknowledgedBy: ctx.userId,
      acknowledgedAt: new Date(),
    })
    .where(eq(dieselAnomalies.id, id));
  await logActivity(id, ctx.userId, 'resolved_anomaly', { notes });
  revalidatePath('/diesel/anomalies');
  return { ok: true, id };
}
