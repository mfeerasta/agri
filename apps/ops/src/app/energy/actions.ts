'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, energyMeters, energyReadings, solarSystems, generatorRuns } from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import {
  energyMeterSchema,
  energyReadingSchema,
  solarSystemSchema,
  generatorRunSchema,
} from '@zameen/shared/validators';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export async function createEnergyMeter(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = energyMeterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const m = parsed.data;
  if (m.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };
  const [row] = await db
    .insert(energyMeters)
    .values({
      entityId: m.entityId,
      meterNumber: m.meterNumber,
      meterKind: m.meterKind,
      assetId: m.assetId ?? null,
      fieldId: m.fieldId ?? null,
      capacityKw: m.capacityKw != null ? String(m.capacityKw) : null,
      tariffPkrPerKwh: m.tariffPkrPerKwh != null ? String(m.tariffPkrPerKwh) : null,
      connectionKind: m.connectionKind ?? null,
      referenceNumber: m.referenceNumber ?? null,
      installedOn: m.installedOn ?? null,
    })
    .returning({ id: energyMeters.id });
  revalidatePath('/energy/meters');
  return { ok: true, id: row!.id };
}

export async function recordEnergyReading(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = energyReadingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const r = parsed.data;
  const [meter] = await db.select().from(energyMeters).where(eq(energyMeters.id, r.meterId)).limit(1);
  if (!meter || meter.entityId !== ctx.entityId) return { ok: false, error: 'Meter not accessible' };

  const [row] = await db
    .insert(energyReadings)
    .values({
      meterId: r.meterId,
      readingDate: r.readingDate,
      readingTime: r.readingTime,
      readingValue: String(r.readingValue),
      consumptionKwh: r.consumptionKwh != null ? String(r.consumptionKwh) : null,
      generationKwh: r.generationKwh != null ? String(r.generationKwh) : null,
      exportKwh: r.exportKwh != null ? String(r.exportKwh) : null,
      costPkr: r.costPkr != null ? String(r.costPkr) : null,
      billUrl: r.billUrl ?? null,
      notes: r.notes ?? null,
    })
    .returning({ id: energyReadings.id });

  if (r.costPkr && r.costPkr > 0) {
    await allocateCost({
      entityId: ctx.entityId,
      sourceModule: 'other',
      sourceRecordId: row!.id,
      costPool: 'electricity',
      amountPkr: r.costPkr,
      allocatedOn: r.readingDate,
      fieldId: meter.fieldId ?? undefined,
      assetId: meter.assetId ?? undefined,
      notes: `Energy reading on meter ${meter.meterNumber} (${meter.meterKind})`,
    });
  }

  revalidatePath('/energy');
  revalidatePath('/energy/meters');
  return { ok: true, id: row!.id };
}

export async function createSolarSystem(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = solarSystemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const s = parsed.data;
  if (s.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };
  const costPerKw = s.costPkr && s.totalCapacityKw > 0 ? s.costPkr / s.totalCapacityKw : undefined;
  const [row] = await db
    .insert(solarSystems)
    .values({
      entityId: s.entityId,
      installationName: s.installationName,
      panelsCount: s.panelsCount,
      totalCapacityKw: String(s.totalCapacityKw),
      panelModel: s.panelModel ?? null,
      inverterModel: s.inverterModel ?? null,
      batteryCapacityKwh: s.batteryCapacityKwh != null ? String(s.batteryCapacityKwh) : null,
      installer: s.installer ?? null,
      commissionedOn: s.commissionedOn,
      warrantyUntil: s.warrantyUntil ?? null,
      costPkr: s.costPkr != null ? String(s.costPkr) : null,
      costPerKwPkr: costPerKw != null ? costPerKw.toFixed(2) : null,
      estimatedAnnualGenerationKwh:
        s.estimatedAnnualGenerationKwh != null ? String(s.estimatedAnnualGenerationKwh) : null,
      netMeteringApproved: s.netMeteringApproved,
      notes: s.notes ?? null,
    })
    .returning({ id: solarSystems.id });
  revalidatePath('/energy/solar');
  return { ok: true, id: row!.id };
}

export async function recordGeneratorRun(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = generatorRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const g = parsed.data;
  const [row] = await db
    .insert(generatorRuns)
    .values({
      assetId: g.assetId,
      startedAt: new Date(g.startedAt),
      endedAt: g.endedAt ? new Date(g.endedAt) : null,
      hoursRun: g.hoursRun != null ? String(g.hoursRun) : null,
      dieselConsumedLiters: g.dieselConsumedLiters != null ? String(g.dieselConsumedLiters) : null,
      outputKwhEstimated: g.outputKwhEstimated != null ? String(g.outputKwhEstimated) : null,
      reason: g.reason ?? null,
      fuelCostPkr: g.fuelCostPkr != null ? String(g.fuelCostPkr) : null,
      notes: g.notes ?? null,
    })
    .returning({ id: generatorRuns.id });
  revalidatePath('/energy/generator-runs');
  return { ok: true, id: row!.id };
}
