'use server';

import { revalidatePath } from 'next/cache';
import { db, bonusRules } from '@zameen/db';

function readNumber(form: FormData, key: string): number | undefined {
  const v = form.get(key);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function createBonusRule(
  entityId: string,
  form: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!entityId) return { ok: false, error: 'Missing entity context.' };
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  const periodKind = String(form.get('periodKind') ?? 'monthly');
  const amountKind = String(form.get('amountKind') ?? 'flat');
  const amountValue = readNumber(form, 'amountValue');
  if (amountValue == null) return { ok: false, error: 'Amount value required.' };
  const topN = readNumber(form, 'topN');
  const minScore = readNumber(form, 'minScore') ?? 0;

  const formula = {
    minDaysPresent: readNumber(form, 'minDaysPresent'),
    maxDaysLate: readNumber(form, 'maxDaysLate'),
    maxTasksLate: readNumber(form, 'maxTasksLate'),
    maxDieselAnomalies: readNumber(form, 'maxDieselAnomalies'),
    minTasksCompleted: readNumber(form, 'minTasksCompleted'),
    minPieceRateUnits: readNumber(form, 'minPieceRateUnits'),
  };

  await db.insert(bonusRules).values({
    entityId,
    name,
    active: true,
    periodKind,
    formula,
    minScore: minScore.toString(),
    amountKind,
    amountValue: amountValue.toString(),
    topN: topN ?? null,
  });

  revalidatePath('/labor/leaderboard/bonus-rules');
  return { ok: true };
}
