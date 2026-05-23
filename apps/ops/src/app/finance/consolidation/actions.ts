'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import {
  db,
  consolidationRuns,
  intercompanyTransactions,
  entityRelationships,
} from '@zameen/db';
import { runConsolidation, finalizeConsolidationRun } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export async function createConsolidationRun(formData: FormData): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('Not authenticated');
  const parentEntityId = String(formData.get('parentEntityId') ?? ctx.entityId);
  const periodStart = String(formData.get('periodStart'));
  const periodEnd = String(formData.get('periodEnd'));
  const includeRaw = formData.getAll('includeChildEntityIds').map(String).filter(Boolean);

  await runConsolidation({
    parentEntityId,
    periodStart,
    periodEnd,
    includeChildEntityIds: includeRaw.length > 0 ? includeRaw : undefined,
    persistRunBy: ctx.userId,
  });
  revalidatePath('/finance/consolidation');
  redirect('/finance/consolidation');
}

export async function finalizeRun(runId: string): Promise<void> {
  await finalizeConsolidationRun(runId);
  revalidatePath('/finance/consolidation');
  revalidatePath(`/finance/consolidation/${runId}`);
}

export async function updateIntercompanyStatus(
  id: string,
  status: 'pending' | 'reconciled' | 'eliminated' | 'disputed',
): Promise<void> {
  await db
    .update(intercompanyTransactions)
    .set({ eliminationStatus: status })
    .where(eq(intercompanyTransactions.id, id));
  revalidatePath('/finance/intercompany');
}

export async function addEntityRelationship(formData: FormData): Promise<void> {
  const parentEntityId = String(formData.get('parentEntityId'));
  const childEntityId = String(formData.get('childEntityId'));
  const ownershipPct = String(formData.get('ownershipPct') ?? '100');
  const effectiveFrom = String(formData.get('effectiveFrom'));
  const consolidationMethod = String(formData.get('consolidationMethod') ?? 'full');
  await db.insert(entityRelationships).values({
    parentEntityId,
    childEntityId,
    ownershipPct,
    effectiveFrom,
    consolidationMethod,
  });
  revalidatePath('/admin/entities');
}
