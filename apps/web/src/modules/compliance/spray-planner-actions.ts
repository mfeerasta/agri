'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, fields, cropPlans, cropProfiles, weatherRecords, tasks, workers, taskAssignments, trainingPrograms, trainingCompletions } from '@zameen/db';
import {
  planSprayWindows,
  findPesticide,
  checkSprayAssignmentGate,
  PESTICIDE_TRAINING_NAME,
  type WeatherForecastDay,
} from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

interface PlanArgs {
  cropPlanId: string;
  pesticideName: string;
  preHarvestIntervalDays: number;
}

export async function buildSprayPlan(args: PlanArgs) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };

  const [plan] = await db
    .select()
    .from(cropPlans)
    .where(eq(cropPlans.id, args.cropPlanId))
    .limit(1);
  if (!plan) return { ok: false as const, error: 'Crop plan not found' };

  const [field] = await db.select().from(fields).where(eq(fields.id, plan.fieldId)).limit(1);
  if (!field) return { ok: false as const, error: 'Field not found' };

  const today = new Date();
  const fromIso = today.toISOString().slice(0, 10);
  const wx = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, ctx.entityId), gte(weatherRecords.recordedFor, fromIso)))
    .orderBy(desc(weatherRecords.recordedFor))
    .limit(7);

  const forecastDays: WeatherForecastDay[] = wx
    .map((w) => ({
      date: new Date(`${String(w.recordedFor)}T00:00:00Z`),
      minTempC: Number(w.minTempC ?? 18),
      maxTempC: Number(w.maxTempC ?? 32),
      rainfallMm: Number(w.rainfallMm ?? 0),
      humidityPct: Number(w.humidityPct ?? 55),
      windKph: Number(w.windKph ?? 6),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Pad to 7 days using last-known if forecast is short.
  while (forecastDays.length < 7 && forecastDays.length > 0) {
    const last = forecastDays[forecastDays.length - 1]!;
    const next = new Date(last.date);
    next.setUTCDate(next.getUTCDate() + 1);
    forecastDays.push({ ...last, date: next });
  }
  if (forecastDays.length === 0) {
    const base = new Date(today);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i);
      forecastDays.push({ date: d, minTempC: 18, maxTempC: 30, rainfallMm: 0, humidityPct: 55, windKph: 6 });
    }
  }

  const phi = args.preHarvestIntervalDays > 0
    ? args.preHarvestIntervalDays
    : findPesticide(args.pesticideName)?.phiDays ?? 14;

  let daysToHarvestEstimate: number | undefined;
  if (plan.plannedHarvestDate) {
    const diffMs = new Date(plan.plannedHarvestDate as unknown as string).getTime() - today.getTime();
    daysToHarvestEstimate = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  }

  const windows = planSprayWindows({
    cropPlanId: args.cropPlanId,
    pesticideName: args.pesticideName,
    preHarvestIntervalDays: phi,
    forecastDays,
    daysToHarvestEstimate,
  });

  return { ok: true as const, windows, fieldId: plan.fieldId };
}

interface ScheduleArgs {
  cropPlanId: string;
  fieldId: string;
  pesticideName: string;
  scheduledForIso: string;
  startHour: number;
  endHour: number;
  proposedWorkerIds?: string[];
}

export async function scheduleSprayTask(args: ScheduleArgs) {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false as const, error: 'Not authenticated' };

  // Training gate: any proposed worker must have a current "Pesticide handling and PPE" cert.
  if (args.proposedWorkerIds && args.proposedWorkerIds.length > 0) {
    const roster = await db
      .select({ id: workers.id, fullName: workers.fullName, isActive: workers.isActive })
      .from(workers)
      .where(eq(workers.entityId, ctx.entityId));
    const programs = await db
      .select({ id: trainingPrograms.id, name: trainingPrograms.name })
      .from(trainingPrograms)
      .where(eq(trainingPrograms.name, PESTICIDE_TRAINING_NAME));
    const programIds = programs.map((p) => p.id);
    const completions = programIds.length
      ? await db
          .select({
            workerId: trainingCompletions.workerId,
            programId: trainingCompletions.programId,
            completedOn: trainingCompletions.completedOn,
            expiresOn: trainingCompletions.expiresOn,
            passed: trainingCompletions.passed,
          })
          .from(trainingCompletions)
          .where(inArray(trainingCompletions.programId, programIds))
      : [];
    const completionsHydrated = completions.map((c) => ({
      workerId: c.workerId,
      programName: PESTICIDE_TRAINING_NAME,
      completedOn: c.completedOn,
      expiresOn: c.expiresOn,
      passed: c.passed,
    }));
    const gate = checkSprayAssignmentGate({
      proposedWorkerIds: args.proposedWorkerIds,
      roster,
      completions: completionsHydrated,
    });
    if (gate.blocked.length > 0) {
      return {
        ok: false as const,
        error: `Blocked: workers missing current ${PESTICIDE_TRAINING_NAME} training.`,
        blocked: gate.blocked,
        reasons: gate.reasons,
        alternates: gate.alternates,
      };
    }
  }

  const [row] = await db
    .insert(tasks)
    .values({
      entityId: ctx.entityId,
      fieldId: args.fieldId,
      cropPlanId: args.cropPlanId,
      title: `Spray ${args.pesticideName}`,
      taskKind: 'spray',
      scheduledFor: args.scheduledForIso,
      priority: 'high',
      description: `Recommended window: ${String(args.startHour).padStart(2, '0')}:00 to ${String(args.endHour).padStart(2, '0')}:00 local.`,
      createdBy: ctx.userId,
    })
    .returning();

  if (args.proposedWorkerIds && args.proposedWorkerIds.length > 0 && row) {
    await db.insert(taskAssignments).values(
      args.proposedWorkerIds.map((wid) => ({ taskId: row.id, workerId: wid })),
    );
  }

  revalidatePath('/compliance/spray-diary/planner');
  return { ok: true as const, id: row!.id };
}

export async function listCropPlanOptions() {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const rows = await db
    .select({
      id: cropPlans.id,
      fieldId: cropPlans.fieldId,
      varietyName: cropPlans.varietyName,
      seasonLabel: cropPlans.seasonLabel,
      cropProfileId: cropPlans.cropProfileId,
    })
    .from(cropPlans);
  const profileIds = Array.from(new Set(rows.map((r) => r.cropProfileId)));
  const profiles = profileIds.length
    ? await db.select().from(cropProfiles)
    : [];
  const profileMap = new Map(profiles.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    id: r.id,
    fieldId: r.fieldId,
    label: `${profileMap.get(r.cropProfileId) ?? 'Crop'} · ${r.seasonLabel}${r.varietyName ? ' · ' + r.varietyName : ''}`,
  }));
}
