'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  animalCreateSchema,
  breedingEventSchema,
  milkRecordSchema,
  milkBulkSchema,
  healthEventSchema,
  feedRecordSchema,
  livestockSaleSchema,
} from '@zameen/shared/validators';
import {
  db,
  animals,
  breedingEvents,
  milkRecords,
  healthEvents,
  feedRecords,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function createAnimal(raw: unknown): Promise<R> {
  const parsed = animalCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(animals)
    .values({
      entityId: data.entityId,
      earTag: data.earTag,
      species: data.species,
      breed: data.breed ?? null,
      sex: data.sex,
      dob: data.dob ?? null,
      damEarTag: data.damEarTag ?? null,
      sireEarTag: data.sireEarTag ?? null,
      acquisitionDate: data.acquisitionDate ?? null,
      acquisitionPricePkr: data.acquisitionPricePkr ?? null,
      photoUrl: data.photoUrl ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  if (data.acquisitionPricePkr) {
    const payload = { animalId: row!.id, ...data };
    const contextSnapshot = await buildFullContext({
      entityId: data.entityId,
      approvalType: 'livestock_purchase',
      payload: payload as Record<string, unknown>,
      requesterUserId: ctx.userId,
      sourceModule: 'livestock',
    });
    await submitApproval({
      entityId: data.entityId,
      approvalType: 'livestock_purchase',
      sourceModule: 'livestock',
      sourceRecordId: row!.id,
      title: `Livestock purchase ${data.species} ${data.earTag}`,
      amountPkr: Number(data.acquisitionPricePkr),
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath('/livestock');
  return { ok: true, id: row!.id };
}

export async function logBreedingEvent(raw: unknown): Promise<R> {
  const parsed = breedingEventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(breedingEvents)
    .values({
      animalId: parsed.data.animalId,
      eventType: parsed.data.eventType,
      eventDate: parsed.data.eventDate,
      details: parsed.data.details ?? null,
      recordedBy: ctx.userId,
    })
    .returning();
  revalidatePath(`/livestock/animals/${parsed.data.animalId}`);
  return { ok: true, id: row!.id };
}

export async function logMilkRecord(raw: unknown): Promise<R> {
  const parsed = milkRecordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(milkRecords)
    .values({
      animalId: parsed.data.animalId,
      recordedOn: parsed.data.recordedOn,
      session: parsed.data.session,
      litres: parsed.data.litres.toString(),
      fatPct: parsed.data.fatPct?.toString() ?? null,
      snfPct: parsed.data.snfPct?.toString() ?? null,
      recordedBy: ctx.userId,
    })
    .returning();
  revalidatePath(`/livestock/animals/${parsed.data.animalId}`);
  return { ok: true, id: row!.id };
}

export async function logMilkBulk(raw: unknown): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = milkBulkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const values = parsed.data.rows.map((r) => ({
    animalId: r.animalId,
    recordedOn: parsed.data.recordedOn,
    session: parsed.data.session,
    litres: r.litres.toString(),
    fatPct: r.fatPct?.toString() ?? null,
    snfPct: r.snfPct?.toString() ?? null,
    recordedBy: ctx.userId,
  }));
  await db.insert(milkRecords).values(values);
  revalidatePath('/livestock');
  return { ok: true, count: values.length };
}

export async function logHealthEvent(raw: unknown): Promise<R> {
  const parsed = healthEventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [row] = await db
    .insert(healthEvents)
    .values({
      animalId: data.animalId,
      eventType: data.eventType,
      eventDate: data.eventDate,
      diagnosis: data.diagnosis ?? null,
      treatment: data.treatment ?? null,
      medicineCostPkr: data.medicineCostPkr ?? null,
      vetCostPkr: data.vetCostPkr ?? null,
      withdrawalUntil: data.withdrawalUntil ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  const medCost = Number(data.medicineCostPkr ?? 0);
  const vetCost = Number(data.vetCostPkr ?? 0);
  const total = medCost + vetCost;
  if (total > 0) {
    await allocateCost({
      entityId: data.entityId,
      sourceModule: 'vet',
      sourceRecordId: row!.id,
      costPool: 'vet',
      amountPkr: total,
      allocatedOn: data.eventDate,
      allocationKey: 'direct',
    });
  }
  revalidatePath(`/livestock/animals/${data.animalId}`);
  return { ok: true, id: row!.id };
}

export async function logFeedRecord(raw: unknown): Promise<R> {
  const parsed = feedRecordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const totalCostPkr = parsed.data.feedMix.reduce((a, m) => a + Number(m.costPkr), 0);
  const [row] = await db
    .insert(feedRecords)
    .values({
      animalId: parsed.data.animalId ?? null,
      groupKey: parsed.data.groupKey ?? null,
      recordedOn: parsed.data.recordedOn,
      feedMix: parsed.data.feedMix,
      totalCostPkr: totalCostPkr.toFixed(2),
      recordedBy: ctx.userId,
    })
    .returning();
  if (totalCostPkr > 0) {
    await allocateCost({
      entityId: parsed.data.entityId,
      sourceModule: 'feed',
      sourceRecordId: row!.id,
      costPool: 'feed',
      amountPkr: totalCostPkr,
      allocatedOn: parsed.data.recordedOn,
      allocationKey: 'direct',
    });
  }
  revalidatePath('/livestock/feed');
  return { ok: true, id: row!.id };
}

export async function submitLivestockSale(raw: unknown): Promise<R> {
  const parsed = livestockSaleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  await db.update(animals).set({ status: 'sold' }).where(eq(animals.id, data.animalId));
  const contextSnapshot = await buildFullContext({
    entityId: data.entityId,
    approvalType: 'livestock_sale',
    payload: data as Record<string, unknown>,
    requesterUserId: ctx.userId,
    sourceModule: 'livestock',
  });
  await submitApproval({
    entityId: data.entityId,
    approvalType: 'livestock_sale',
    sourceModule: 'livestock',
    sourceRecordId: data.animalId,
    title: `Livestock sale to ${data.buyer}`,
    amountPkr: Number(data.salePricePkr),
    payload: data,
    contextSnapshot,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });
  revalidatePath('/livestock');
  return { ok: true, id: data.animalId };
}
