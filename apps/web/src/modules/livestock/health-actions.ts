'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db, animals, livestockHealthEvents } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export type HealthEventKind = 'vaccination' | 'treatment' | 'illness' | 'injury' | 'deworming' | 'hoof_trim' | 'death';

const PHOTO_REQUIRED_KINDS: HealthEventKind[] = ['treatment', 'illness', 'injury', 'death'];

export interface HealthEventRow {
  id: string;
  animalId: string;
  earTag: string;
  eventKind: HealthEventKind;
  occurredOn: string;
  diagnosis: string | null;
  medication: string | null;
  dosage: string | null;
  vetName: string | null;
  costPkr: number | null;
  withdrawalPeriodDays: number | null;
  nextDueOn: string | null;
  notes: string | null;
  photoUrls: string[];
}

export async function loadHealthEvents(entityId: string): Promise<HealthEventRow[]> {
  const ent = await db.select({ id: animals.id, earTag: animals.earTag }).from(animals).where(eq(animals.entityId, entityId));
  if (!ent.length) return [];
  const tagById = new Map(ent.map((a) => [a.id, a.earTag]));
  const rows = await db
    .select()
    .from(livestockHealthEvents)
    .where(inArray(livestockHealthEvents.animalId, ent.map((a) => a.id)))
    .orderBy(desc(livestockHealthEvents.occurredOn));

  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    earTag: tagById.get(r.animalId) ?? '',
    eventKind: r.eventKind as HealthEventKind,
    occurredOn: typeof r.occurredOn === 'string' ? r.occurredOn : new Date(r.occurredOn as unknown as string).toISOString().slice(0, 10),
    diagnosis: r.diagnosis,
    medication: r.medication,
    dosage: r.dosage,
    vetName: r.vetName,
    costPkr: r.costPkr != null ? Number(r.costPkr) : null,
    withdrawalPeriodDays: r.withdrawalPeriodDays,
    nextDueOn: r.nextDueOn
      ? (typeof r.nextDueOn === 'string' ? r.nextDueOn : new Date(r.nextDueOn as unknown as string).toISOString().slice(0, 10))
      : null,
    notes: r.notes,
    photoUrls: r.photoUrls ?? [],
  }));
}

export async function loadHealthForAnimal(animalId: string): Promise<HealthEventRow[]> {
  const [a] = await db.select({ earTag: animals.earTag }).from(animals).where(eq(animals.id, animalId));
  const rows = await db
    .select()
    .from(livestockHealthEvents)
    .where(eq(livestockHealthEvents.animalId, animalId))
    .orderBy(desc(livestockHealthEvents.occurredOn));
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    earTag: a?.earTag ?? '',
    eventKind: r.eventKind as HealthEventKind,
    occurredOn: typeof r.occurredOn === 'string' ? r.occurredOn : new Date(r.occurredOn as unknown as string).toISOString().slice(0, 10),
    diagnosis: r.diagnosis,
    medication: r.medication,
    dosage: r.dosage,
    vetName: r.vetName,
    costPkr: r.costPkr != null ? Number(r.costPkr) : null,
    withdrawalPeriodDays: r.withdrawalPeriodDays,
    nextDueOn: r.nextDueOn
      ? (typeof r.nextDueOn === 'string' ? r.nextDueOn : new Date(r.nextDueOn as unknown as string).toISOString().slice(0, 10))
      : null,
    notes: r.notes,
    photoUrls: r.photoUrls ?? [],
  }));
}

export interface LogHealthEventArgs {
  animalId: string;
  eventKind: HealthEventKind;
  occurredOn: string;
  diagnosis?: string;
  medication?: string;
  dosage?: string;
  vetName?: string;
  costPkr?: number;
  withdrawalPeriodDays?: number;
  nextDueOn?: string;
  notes?: string;
  photoUrls?: string[];
}

export async function logHealthEvent(args: LogHealthEventArgs): Promise<{ ok: boolean; error?: string; id?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const needsPhoto = PHOTO_REQUIRED_KINDS.includes(args.eventKind);
  if (needsPhoto && (!args.photoUrls || args.photoUrls.length === 0)) {
    return { ok: false, error: 'Photo evidence required for treatments and illnesses' };
  }

  const [row] = await db
    .insert(livestockHealthEvents)
    .values({
      animalId: args.animalId,
      eventKind: args.eventKind,
      occurredOn: args.occurredOn,
      diagnosis: args.diagnosis,
      medication: args.medication,
      dosage: args.dosage,
      vetName: args.vetName,
      costPkr: args.costPkr != null ? args.costPkr.toString() : null,
      withdrawalPeriodDays: args.withdrawalPeriodDays,
      nextDueOn: args.nextDueOn,
      notes: args.notes,
      photoUrls: args.photoUrls ?? [],
    })
    .returning({ id: livestockHealthEvents.id });

  revalidatePath('/livestock/health');
  return { ok: true, id: row?.id };
}

export async function vaccinationsDueWithin(entityId: string, days = 14): Promise<HealthEventRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const ent = await db.select({ id: animals.id, earTag: animals.earTag }).from(animals).where(eq(animals.entityId, entityId));
  if (!ent.length) return [];
  const tagById = new Map(ent.map((a) => [a.id, a.earTag]));
  const rows = await db
    .select()
    .from(livestockHealthEvents)
    .where(
      and(
        inArray(livestockHealthEvents.animalId, ent.map((a) => a.id)),
        gte(livestockHealthEvents.nextDueOn, today),
        lte(livestockHealthEvents.nextDueOn, horizon),
      ),
    )
    .orderBy(livestockHealthEvents.nextDueOn);
  return rows.map((r) => ({
    id: r.id,
    animalId: r.animalId,
    earTag: tagById.get(r.animalId) ?? '',
    eventKind: r.eventKind as HealthEventKind,
    occurredOn: typeof r.occurredOn === 'string' ? r.occurredOn : new Date(r.occurredOn as unknown as string).toISOString().slice(0, 10),
    diagnosis: r.diagnosis,
    medication: r.medication,
    dosage: r.dosage,
    vetName: r.vetName,
    costPkr: r.costPkr != null ? Number(r.costPkr) : null,
    withdrawalPeriodDays: r.withdrawalPeriodDays,
    nextDueOn: r.nextDueOn
      ? (typeof r.nextDueOn === 'string' ? r.nextDueOn : new Date(r.nextDueOn as unknown as string).toISOString().slice(0, 10))
      : null,
    notes: r.notes,
    photoUrls: r.photoUrls ?? [],
  }));
}

export async function currentHealthStatus(animalId: string): Promise<string> {
  const [latest] = await db
    .select({ kind: livestockHealthEvents.eventKind, occurredOn: livestockHealthEvents.occurredOn })
    .from(livestockHealthEvents)
    .where(eq(livestockHealthEvents.animalId, animalId))
    .orderBy(desc(livestockHealthEvents.occurredOn))
    .limit(1);
  if (!latest) return 'no events recorded';
  if (latest.kind === 'death') return 'deceased';
  const daysSince = Math.round(
    (Date.now() - new Date(latest.occurredOn as unknown as string).getTime()) / 86_400_000,
  );
  if (['illness', 'injury', 'treatment'].includes(latest.kind) && daysSince < 14) return `under care (${latest.kind})`;
  return 'healthy';
}
