'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, weatherIndexTriggers } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import type { WeatherIndexTriggerKind } from '@zameen/db';

type Result = { ok: true; id: string } | { ok: false; error: string };

export interface CreateTriggerInput {
  policyId: string;
  triggerKind: WeatherIndexTriggerKind;
  thresholdValue: number;
  measurementWindowDays: number;
  payoutPerUnitPkr?: number;
  maxPayoutPkr?: number;
  notes?: string;
}

export async function createWeatherIndexTrigger(input: CreateTriggerInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.measurementWindowDays <= 0) return { ok: false, error: 'Window must be positive' };

  const [row] = await db
    .insert(weatherIndexTriggers)
    .values({
      policyId: input.policyId,
      triggerKind: input.triggerKind,
      thresholdValue: input.thresholdValue.toFixed(3),
      measurementWindowDays: input.measurementWindowDays,
      payoutPerUnitPkr: input.payoutPerUnitPkr?.toFixed(2) ?? null,
      maxPayoutPkr: input.maxPayoutPkr?.toFixed(2) ?? null,
      notes: input.notes ?? null,
      isActive: true,
    })
    .returning();
  if (!row) return { ok: false, error: 'Insert failed' };

  revalidatePath(`/compliance/insurance/policies/${input.policyId}/triggers`);
  return { ok: true, id: row.id };
}

export async function toggleWeatherIndexTrigger(id: string, isActive: boolean): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.update(weatherIndexTriggers).set({ isActive }).where(eq(weatherIndexTriggers.id, id));
  return { ok: true, id };
}

export async function deleteWeatherIndexTrigger(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.delete(weatherIndexTriggers).where(eq(weatherIndexTriggers.id, id));
  return { ok: true, id };
}
