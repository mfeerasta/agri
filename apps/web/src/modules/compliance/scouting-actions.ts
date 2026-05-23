'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, gte, sql as dsql } from 'drizzle-orm';
import {
  db,
  scoutingObservations,
  actionThresholds,
  beneficialInsectLogs,
  fields,
  cropPlans,
  cropProfiles,
  inputs,
  type ScoutMethod,
} from '@zameen/db';
import { getSessionContext } from '@/lib/session';

interface CreateObservationArgs {
  fieldId: string;
  cropPlanId?: string;
  observedAtIso: string;
  scoutMethod?: ScoutMethod;
  sampleCount?: number;
  pestOrDisease: string;
  severity: number;
  prevalencePct?: number;
  growthStage?: string;
  gpsLocation?: { lat: number; lng: number; accuracy?: number };
  photoUrls: string[];
  voiceNoteUrl?: string;
  aiDiagnosticId?: string;
  notes?: string;
}

export interface ThresholdHit {
  thresholdId: string;
  recommendedResponse: string;
  ipmNotes: string | null;
  suggestedInputId: string | null;
  suggestedInputName: string | null;
}

export async function createScoutingObservation(args: CreateObservationArgs) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };
  if (!args.photoUrls?.length) return { ok: false as const, error: 'At least one photo is required.' };
  if (args.severity < 1 || args.severity > 5) return { ok: false as const, error: 'Severity must be 1 to 5.' };

  // Look up crop code if a plan was selected.
  let cropCode: string | null = null;
  if (args.cropPlanId) {
    const rows = await db
      .select({ name: cropProfiles.name })
      .from(cropPlans)
      .innerJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
      .where(eq(cropPlans.id, args.cropPlanId))
      .limit(1);
    cropCode = rows[0]?.name?.toLowerCase() ?? null;
  }

  // Threshold lookup. Entity override first, then global default.
  let thresholdHit: ThresholdHit | null = null;
  if (cropCode) {
    const candidates = await db
      .select()
      .from(actionThresholds)
      .where(
        and(
          eq(actionThresholds.cropCode, cropCode),
          eq(actionThresholds.pestOrDisease, args.pestOrDisease),
        ),
      );
    // Prefer entity-specific row.
    const t = candidates.find((c) => c.entityId === ctx.entityId) ?? candidates.find((c) => c.entityId === null);
    if (t) {
      const sevHit = t.thresholdSeverity != null && args.severity >= t.thresholdSeverity;
      const prevHit = t.thresholdPrevalencePct != null && args.prevalencePct != null
        && Number(args.prevalencePct) >= Number(t.thresholdPrevalencePct);
      if (sevHit || prevHit) {
        // Suggest an input from inventory whose active ingredient appears in the recommendation.
        const candidateInputs = await db
          .select({ id: inputs.id, name: inputs.name, activeIngredient: inputs.activeIngredient })
          .from(inputs)
          .where(and(eq(inputs.entityId, ctx.entityId), eq(inputs.type, 'pesticide')));
        const text = t.recommendedResponse.toLowerCase();
        const matched = candidateInputs.find((i) => {
          const ai = (i.activeIngredient ?? '').toLowerCase();
          const nm = i.name.toLowerCase();
          return (ai && text.includes(ai)) || (nm && text.includes(nm));
        });
        thresholdHit = {
          thresholdId: t.id,
          recommendedResponse: t.recommendedResponse,
          ipmNotes: t.ipmNotes,
          suggestedInputId: matched?.id ?? null,
          suggestedInputName: matched?.name ?? null,
        };
      }
    }
  }

  const [row] = await db
    .insert(scoutingObservations)
    .values({
      fieldId: args.fieldId,
      cropPlanId: args.cropPlanId ?? null,
      observedAt: new Date(args.observedAtIso),
      observerId: ctx.userId,
      scoutMethod: args.scoutMethod ?? null,
      sampleCount: args.sampleCount ?? null,
      pestOrDisease: args.pestOrDisease,
      severity: args.severity,
      prevalencePct: args.prevalencePct != null ? String(args.prevalencePct) : null,
      growthStage: args.growthStage ?? null,
      gpsLocation: args.gpsLocation ?? null,
      photoUrls: args.photoUrls,
      voiceNoteUrl: args.voiceNoteUrl ?? null,
      aiDiagnosticId: args.aiDiagnosticId ?? null,
      recommendedAction: thresholdHit?.recommendedResponse ?? null,
      notes: args.notes ?? null,
    })
    .returning();

  revalidatePath('/compliance/scouting');
  revalidatePath('/compliance/scouting/heatmap');
  return { ok: true as const, id: row!.id, thresholdHit };
}

export async function listScoutingForField(fieldId: string, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(scoutingObservations)
    .where(and(eq(scoutingObservations.fieldId, fieldId), gte(scoutingObservations.observedAt, since)))
    .orderBy(desc(scoutingObservations.observedAt));
}

export async function listBeneficialsForField(fieldId: string, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(beneficialInsectLogs)
    .where(and(eq(beneficialInsectLogs.fieldId, fieldId), gte(beneficialInsectLogs.observedAt, since)))
    .orderBy(desc(beneficialInsectLogs.observedAt));
}

/**
 * Beneficial ratio: total beneficial counts divided by total pest severity x sample
 * within the recent window. Higher means more natural enemies relative to pest pressure.
 * Anything above 0.5 is treated as "healthy IPM balance" and the spray planner
 * should avoid broad-spectrum chemistry.
 */
export async function computeBeneficialRatio(fieldId: string, days = 14): Promise<number> {
  const [pests, benes] = await Promise.all([
    listScoutingForField(fieldId, days),
    listBeneficialsForField(fieldId, days),
  ]);
  const pestLoad = pests.reduce((acc, p) => acc + p.severity * Math.max(1, p.sampleCount ?? 1), 0);
  const beneCount = benes.reduce((acc, b) => acc + (b.countEstimate ?? 1), 0);
  if (pestLoad === 0) return beneCount > 0 ? 1 : 0;
  return beneCount / pestLoad;
}

interface CreateBeneficialArgs {
  fieldId: string;
  observedAtIso: string;
  species: string;
  countEstimate?: number;
  notes?: string;
  photoUrls: string[];
}

export async function logBeneficialInsect(args: CreateBeneficialArgs) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };
  const [row] = await db
    .insert(beneficialInsectLogs)
    .values({
      fieldId: args.fieldId,
      observedAt: new Date(args.observedAtIso),
      species: args.species,
      countEstimate: args.countEstimate ?? null,
      notes: args.notes ?? null,
      photoUrls: args.photoUrls ?? [],
    })
    .returning();
  revalidatePath('/compliance/ipm/beneficials');
  return { ok: true as const, id: row!.id };
}

export async function listFieldOptions() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const rows = await db
    .select({ id: fields.id, code: fields.code, name: fields.name })
    .from(fields)
    .limit(500);
  return rows.map((r) => ({ id: r.id, label: `${r.code}${r.name ? ' · ' + r.name : ''}` }));
}

export async function listThresholds() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(actionThresholds)
    .orderBy(actionThresholds.cropCode, actionThresholds.pestOrDisease);
}

interface UpsertThresholdArgs {
  id?: string;
  cropCode: string;
  pestOrDisease: string;
  thresholdSeverity?: number;
  thresholdPrevalencePct?: number;
  recommendedResponse: string;
  ipmNotes?: string;
  scope: 'entity' | 'global';
}

export async function upsertThreshold(args: UpsertThresholdArgs) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };
  const entityId = args.scope === 'entity' ? ctx.entityId : null;

  if (args.id) {
    await db
      .update(actionThresholds)
      .set({
        cropCode: args.cropCode,
        pestOrDisease: args.pestOrDisease,
        thresholdSeverity: args.thresholdSeverity ?? null,
        thresholdPrevalencePct: args.thresholdPrevalencePct != null ? String(args.thresholdPrevalencePct) : null,
        recommendedResponse: args.recommendedResponse,
        ipmNotes: args.ipmNotes ?? null,
      })
      .where(eq(actionThresholds.id, args.id));
  } else {
    await db.insert(actionThresholds).values({
      entityId,
      cropCode: args.cropCode,
      pestOrDisease: args.pestOrDisease,
      thresholdSeverity: args.thresholdSeverity ?? null,
      thresholdPrevalencePct: args.thresholdPrevalencePct != null ? String(args.thresholdPrevalencePct) : null,
      recommendedResponse: args.recommendedResponse,
      ipmNotes: args.ipmNotes ?? null,
      source: 'entity_custom',
    });
  }
  revalidatePath('/compliance/ipm/thresholds');
  return { ok: true as const };
}

/**
 * Aggregate severity by ISO date for the heatmap calendar (last 30 days).
 */
export async function scoutingCalendar(days = 30) {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      day: dsql<string>`to_char(${scoutingObservations.observedAt}, 'YYYY-MM-DD')`,
      pest: scoutingObservations.pestOrDisease,
      severity: scoutingObservations.severity,
      fieldId: scoutingObservations.fieldId,
    })
    .from(scoutingObservations)
    .where(gte(scoutingObservations.observedAt, since));
  return rows;
}
