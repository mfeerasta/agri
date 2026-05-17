'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  bankReconUploadSchema,
  cashFlowRefreshSchema,
} from '@zameen/shared/validators';
import { db, cashFlowForecasts } from '@zameen/db';
import { computeCashFlowForecast, reconcileInputStock } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function refreshCashFlow(raw: unknown): Promise<R> {
  const parsed = cashFlowRefreshSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const forecast = await computeCashFlowForecast({
    entityId: parsed.data.entityId,
    horizonDays: parsed.data.horizonDays,
  });

  const [row] = await db
    .insert(cashFlowForecasts)
    .values({
      entityId: parsed.data.entityId,
      generatedOn: new Date().toISOString().slice(0, 10),
      horizonDays: parsed.data.horizonDays.toString(),
      rows: forecast.rows,
      cashGapWarnings: forecast.warnings,
      generatedBy: ctx.userId,
    })
    .returning();

  revalidatePath('/finance/cash-flow');
  return { ok: true, id: row!.id };
}

export async function submitBankRecon(raw: unknown): Promise<R> {
  const parsed = bankReconUploadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  return { ok: true, id: 'bank-recon-pending' };
}

export async function runInputReconciliation(entityId: string): Promise<R> {
  if (!entityId) return { ok: false, error: 'entityId required' };
  const asOfDate = new Date().toISOString().slice(0, 10);
  await reconcileInputStock({ entityId, asOfDate });
  revalidatePath('/finance/reconciliation/inputs');
  return { ok: true, id: entityId };
}
