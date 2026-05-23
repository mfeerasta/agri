'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, animals, livestockBreedingCycles } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export type BreedingOutcome = 'pending' | 'pregnant' | 'aborted' | 'calved' | 'failed';

const SPECIES_GESTATION_DAYS: Record<string, number> = {
  cattle: 283,
  buffalo: 310,
  goat: 150,
  sheep: 147,
  other: 280,
};

export interface BreedingEventRow {
  id: string;
  femaleEarTag: string;
  femaleSpecies: string;
  maleEarTag: string | null;
  semenSource: string | null;
  bredOn: string;
  expectedCalvingDate: string | null;
  actualCalvingDate: string | null;
  confirmedPregnantOn: string | null;
  offspringCount: number | null;
  outcome: BreedingOutcome | null;
  vetName: string | null;
  costPkr: number | null;
}

export async function loadBreedingEvents(entityId: string): Promise<BreedingEventRow[]> {
  const ent = await db
    .select({ id: animals.id, earTag: animals.earTag, species: animals.species })
    .from(animals)
    .where(eq(animals.entityId, entityId));
  if (!ent.length) return [];
  const animalById = new Map(ent.map((a) => [a.id, a]));
  const ids = ent.map((a) => a.id);
  const rows = await db
    .select()
    .from(livestockBreedingCycles)
    .where(inArray(livestockBreedingCycles.femaleAnimalId, ids))
    .orderBy(desc(livestockBreedingCycles.bredOn));

  return rows.map((r) => {
    const female = animalById.get(r.femaleAnimalId);
    const male = r.maleAnimalId ? animalById.get(r.maleAnimalId) : null;
    return {
      id: r.id,
      femaleEarTag: female?.earTag ?? '',
      femaleSpecies: female?.species ?? '',
      maleEarTag: male?.earTag ?? null,
      semenSource: r.semenSource,
      bredOn: typeof r.bredOn === 'string' ? r.bredOn : new Date(r.bredOn as unknown as string).toISOString().slice(0, 10),
      expectedCalvingDate: r.expectedCalvingDate ? (typeof r.expectedCalvingDate === 'string' ? r.expectedCalvingDate : new Date(r.expectedCalvingDate as unknown as string).toISOString().slice(0, 10)) : null,
      actualCalvingDate: r.actualCalvingDate ? (typeof r.actualCalvingDate === 'string' ? r.actualCalvingDate : new Date(r.actualCalvingDate as unknown as string).toISOString().slice(0, 10)) : null,
      confirmedPregnantOn: r.confirmedPregnantOn ? (typeof r.confirmedPregnantOn === 'string' ? r.confirmedPregnantOn : new Date(r.confirmedPregnantOn as unknown as string).toISOString().slice(0, 10)) : null,
      offspringCount: r.offspringCount,
      outcome: (r.outcome as BreedingOutcome | null) ?? null,
      vetName: r.vetName,
      costPkr: r.costPkr != null ? Number(r.costPkr) : null,
    };
  });
}

export interface LogBreedingArgs {
  femaleAnimalId: string;
  maleAnimalId?: string;
  semenSource?: string;
  bredOn: string;
  expectedCalvingDate?: string;
  confirmedPregnantOn?: string;
  outcome?: BreedingOutcome;
  vetName?: string;
  costPkr?: number;
  notes?: string;
}

export async function logBreedingEvent(args: LogBreedingArgs): Promise<{ ok: boolean; error?: string; id?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  let expected = args.expectedCalvingDate;
  if (!expected) {
    const [female] = await db.select({ species: animals.species }).from(animals).where(eq(animals.id, args.femaleAnimalId));
    const gd = SPECIES_GESTATION_DAYS[female?.species ?? 'other'] ?? 280;
    const d = new Date(args.bredOn);
    d.setUTCDate(d.getUTCDate() + gd);
    expected = d.toISOString().slice(0, 10);
  }

  const [row] = await db
    .insert(livestockBreedingCycles)
    .values({
      femaleAnimalId: args.femaleAnimalId,
      maleAnimalId: args.maleAnimalId,
      semenSource: args.semenSource,
      bredOn: args.bredOn,
      expectedCalvingDate: expected,
      confirmedPregnantOn: args.confirmedPregnantOn,
      outcome: args.outcome ?? 'pending',
      vetName: args.vetName,
      costPkr: args.costPkr != null ? args.costPkr.toString() : null,
      notes: args.notes,
    })
    .returning({ id: livestockBreedingCycles.id });

  revalidatePath('/livestock/breeding');
  return { ok: true, id: row?.id };
}

export interface UpdateBreedingArgs {
  id: string;
  confirmedPregnantOn?: string;
  actualCalvingDate?: string;
  offspringCount?: number;
  outcome?: BreedingOutcome;
  notes?: string;
}

export async function updateBreedingEvent(args: UpdateBreedingArgs): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(livestockBreedingCycles)
    .set({
      confirmedPregnantOn: args.confirmedPregnantOn,
      actualCalvingDate: args.actualCalvingDate,
      offspringCount: args.offspringCount,
      outcome: args.outcome,
      notes: args.notes,
    })
    .where(eq(livestockBreedingCycles.id, args.id));
  revalidatePath('/livestock/breeding');
  return { ok: true };
}

/**
 * Average gestation interval from breeding date to actual calving date for this animal.
 * Used to project the "next" expected calving once a new breeding event is logged.
 */
export async function predictNextCalving(animalId: string): Promise<{ avgGestationDays: number; calvings: number } | null> {
  const rows = await db
    .select({ bredOn: livestockBreedingCycles.bredOn, actualCalvingDate: livestockBreedingCycles.actualCalvingDate })
    .from(livestockBreedingCycles)
    .where(and(eq(livestockBreedingCycles.femaleAnimalId, animalId), isNotNull(livestockBreedingCycles.actualCalvingDate)));
  if (!rows.length) return null;
  let sumDays = 0;
  let n = 0;
  for (const r of rows) {
    if (!r.actualCalvingDate || !r.bredOn) continue;
    const bred = new Date(r.bredOn as unknown as string);
    const calved = new Date(r.actualCalvingDate as unknown as string);
    const diff = Math.round((calved.getTime() - bred.getTime()) / 86_400_000);
    if (diff > 0 && diff < 400) {
      sumDays += diff;
      n += 1;
    }
  }
  if (n === 0) return null;
  return { avgGestationDays: Math.round(sumDays / n), calvings: n };
}

export async function countCalvings(animalId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(livestockBreedingCycles)
    .where(and(eq(livestockBreedingCycles.femaleAnimalId, animalId), eq(livestockBreedingCycles.outcome, 'calved')));
  return Number(row?.n ?? 0);
}
