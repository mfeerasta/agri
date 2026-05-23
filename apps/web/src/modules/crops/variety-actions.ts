'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, cropVarieties, varietyTrials, harvestLossRecords, cropPlans } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type Result<T extends string = 'id'> = { ok: true; [k: string]: string | boolean } | { ok: false; error: string };

export async function createVarietyTrial(raw: {
  fieldId: string;
  varietyId: string;
  season: string;
  plantedOn: string;
  cropPlanId?: string;
  areaAcres: number;
  yieldKg?: number;
  qualityGrade?: string;
  diseasePressureSeverity?: number;
  pestPressureSeverity?: number;
  netRevenuePkr?: number;
  weatherStressNotes?: string;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!raw.fieldId || !raw.varietyId || !raw.season || !raw.plantedOn) {
    return { ok: false, error: 'Missing required field' };
  }
  if (Number(raw.areaAcres) <= 0) return { ok: false, error: 'areaAcres must be > 0' };

  // Auto-link to active crop plan if not supplied.
  let cropPlanId = raw.cropPlanId ?? null;
  if (!cropPlanId) {
    const [active] = await db
      .select({ id: cropPlans.id })
      .from(cropPlans)
      .where(eq(cropPlans.fieldId, raw.fieldId))
      .orderBy(cropPlans.createdAt)
      .limit(1);
    cropPlanId = active?.id ?? null;
  }

  const yieldKg = raw.yieldKg ?? 0;
  const yieldPerAcre = raw.areaAcres > 0 ? Number((yieldKg / raw.areaAcres).toFixed(2)) : 0;

  const [row] = await db
    .insert(varietyTrials)
    .values({
      entityId: ctx.entityId,
      fieldId: raw.fieldId,
      varietyId: raw.varietyId,
      cropPlanId,
      season: raw.season,
      plantedOn: raw.plantedOn,
      areaAcres: raw.areaAcres.toString(),
      yieldKg: raw.yieldKg != null ? raw.yieldKg.toString() : null,
      yieldPerAcreKg: yieldKg > 0 ? yieldPerAcre.toString() : null,
      qualityGrade: raw.qualityGrade ?? null,
      diseasePressureSeverity: raw.diseasePressureSeverity ?? null,
      pestPressureSeverity: raw.pestPressureSeverity ?? null,
      netRevenuePkr: raw.netRevenuePkr != null ? raw.netRevenuePkr.toString() : null,
      weatherStressNotes: raw.weatherStressNotes ?? null,
      notes: raw.notes ?? null,
    })
    .returning();

  revalidatePath('/crops/trials');
  revalidatePath('/crops/yield-optimization');
  return { ok: true, id: row.id };
}

export async function createHarvestLoss(raw: {
  harvestRecordId: string;
  fieldId?: string;
  lossKind:
    | 'shattering'
    | 'spillage'
    | 'rain_damage'
    | 'bird_damage'
    | 'rodent_damage'
    | 'storage_pest'
    | 'quality_downgrade'
    | 'rejection'
    | 'other';
  estimatedKg: number;
  estimatedValuePkr?: number;
  cause?: string;
  preventable?: boolean;
  notes?: string;
  photoUrls: string[];
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!raw.harvestRecordId) return { ok: false, error: 'Missing harvest record' };
  if (raw.estimatedKg <= 0) return { ok: false, error: 'estimatedKg must be > 0' };
  if (!raw.photoUrls || raw.photoUrls.length === 0) {
    return { ok: false, error: 'At least one photo required' };
  }

  const [row] = await db
    .insert(harvestLossRecords)
    .values({
      harvestRecordId: raw.harvestRecordId,
      fieldId: raw.fieldId ?? null,
      lossKind: raw.lossKind,
      estimatedKg: raw.estimatedKg.toString(),
      estimatedValuePkr: raw.estimatedValuePkr != null ? raw.estimatedValuePkr.toString() : null,
      cause: raw.cause ?? null,
      preventable: raw.preventable ?? null,
      notes: raw.notes ?? null,
      photoUrls: raw.photoUrls,
    })
    .returning();

  revalidatePath('/crops/harvest-losses');
  return { ok: true, id: row.id };
}

export async function listVarieties(cropProfileCode?: string) {
  const rows = cropProfileCode
    ? await db.select().from(cropVarieties).where(eq(cropVarieties.cropProfileCode, cropProfileCode))
    : await db.select().from(cropVarieties);
  return rows;
}
