'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import {
  db,
  warabandiSlots,
  irrigationEvents,
  irrigationSchedules,
  fields,
  blocks,
  farms,
} from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type ServerResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

interface WarabandiSlotInput {
  waterSourceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  rotationWeeks?: number;
  notes?: string;
  isActive?: boolean;
}

export async function upsertWarabandiSlot(input: WarabandiSlotInput, id?: string): Promise<ServerResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) return { ok: false, error: 'Invalid day' };
  if (input.startTime >= input.endTime) return { ok: false, error: 'Start time must precede end time' };

  if (id) {
    await db.update(warabandiSlots)
      .set({
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        rotationWeeks: input.rotationWeeks ?? 1,
        notes: input.notes ?? null,
        isActive: input.isActive ?? true,
      })
      .where(eq(warabandiSlots.id, id));
    revalidatePath('/app/compliance/warabandi');
    return { ok: true, id };
  }

  const [row] = await db.insert(warabandiSlots).values({
    waterSourceId: input.waterSourceId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    rotationWeeks: input.rotationWeeks ?? 1,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
  }).returning({ id: warabandiSlots.id });
  revalidatePath('/app/compliance/warabandi');
  return { ok: true, id: row!.id };
}

export async function deleteWarabandiSlot(id: string): Promise<ServerResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.delete(warabandiSlots).where(eq(warabandiSlots.id, id));
  revalidatePath('/app/compliance/warabandi');
  return { ok: true, id };
}

interface ScheduleInput {
  fieldId: string;
  warabandiSlotId?: string;
  waterSourceId?: string;
  scheduledFor: string;
  expectedDurationMinutes?: number;
  cropPlanId?: string;
}

export async function createSchedule(input: ScheduleInput): Promise<ServerResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const scheduledAt = new Date(input.scheduledFor);
  const windowStart = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(scheduledAt.getTime() + 60 * 60 * 1000);

  const conflicts = await db
    .select({ id: irrigationSchedules.id })
    .from(irrigationSchedules)
    .where(and(
      eq(irrigationSchedules.fieldId, input.fieldId),
      gte(irrigationSchedules.scheduledFor, windowStart),
      lte(irrigationSchedules.scheduledFor, windowEnd),
      eq(irrigationSchedules.status, 'planned'),
    ));

  if (conflicts.length > 0) {
    return { ok: false, error: 'Field already has a planned irrigation within ±1h of this slot' };
  }

  const [row] = await db.insert(irrigationSchedules).values({
    fieldId: input.fieldId,
    cropPlanId: input.cropPlanId ?? null,
    scheduledFor: scheduledAt,
    warabandiSlotId: input.warabandiSlotId ?? null,
    waterSourceId: input.waterSourceId ?? null,
    expectedDurationMinutes: input.expectedDurationMinutes ?? null,
    status: 'planned',
    createdBySystem: false,
  }).returning({ id: irrigationSchedules.id });

  revalidatePath('/app/compliance/irrigation/schedule');
  return { ok: true, id: row!.id };
}

export async function skipSchedule(id: string, reason: string): Promise<ServerResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.update(irrigationSchedules)
    .set({ status: 'skipped', reasonIfSkipped: reason })
    .where(eq(irrigationSchedules.id, id));
  revalidatePath('/app/compliance/irrigation/schedule');
  return { ok: true, id };
}

interface LogEventInput {
  fieldId: string;
  waterSourceId: string;
  startedAt: string;
  endedAt?: string;
  method?: 'flood' | 'furrow' | 'sprinkler' | 'drip' | 'basin';
  estimatedDepthMm?: number;
  dieselUsedLiters?: number;
  dieselLogId?: string;
  notes?: string;
  photoUrls?: string[];
  costPkr?: number;
  scheduleId?: string;
}

export async function logIrrigationEvent(input: LogEventInput): Promise<ServerResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const start = new Date(input.startedAt);
  const end = input.endedAt ? new Date(input.endedAt) : null;
  const durationMinutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
  if (end && end <= start) return { ok: false, error: 'End time must be after start' };

  // Volume estimate: depth (mm) * area (acres -> m2)
  const [fieldRow] = await db
    .select({ acres: fields.acres, blockId: fields.blockId })
    .from(fields)
    .where(eq(fields.id, input.fieldId));
  if (!fieldRow) return { ok: false, error: 'Field not found' };

  const acres = Number(fieldRow.acres ?? 0);
  const m2 = acres * 4046.86;
  const volumeM3 = input.estimatedDepthMm ? Number(((input.estimatedDepthMm / 1000) * m2).toFixed(2)) : null;

  // entityId for cost allocation
  const [farmRow] = await db
    .select({ entityId: farms.entityId })
    .from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId))
    .where(eq(fields.id, input.fieldId));

  const [row] = await db.insert(irrigationEvents).values({
    fieldId: input.fieldId,
    waterSourceId: input.waterSourceId,
    startedAt: start,
    endedAt: end,
    durationMinutes,
    estimatedVolumeM3: volumeM3 !== null ? volumeM3.toString() : null,
    estimatedDepthMm: input.estimatedDepthMm !== undefined ? input.estimatedDepthMm.toString() : null,
    dieselUsedLiters: input.dieselUsedLiters !== undefined ? input.dieselUsedLiters.toString() : null,
    dieselLogId: input.dieselLogId ?? null,
    method: input.method ?? null,
    operatorId: ctx.userId,
    notes: input.notes ?? null,
    photoUrls: input.photoUrls ?? [],
    costPkr: input.costPkr !== undefined ? input.costPkr.toString() : null,
  }).returning({ id: irrigationEvents.id });

  if (input.costPkr && input.costPkr > 0 && farmRow) {
    await allocateCost({
      entityId: farmRow.entityId,
      sourceModule: 'irrigation',
      sourceRecordId: row!.id,
      costPool: 'irrigation',
      amountPkr: input.costPkr,
      allocatedOn: start.toISOString().slice(0, 10),
      fieldId: input.fieldId,
      notes: input.notes,
    });
  }

  if (input.scheduleId) {
    await db.update(irrigationSchedules)
      .set({ status: 'completed', completedEventId: row!.id })
      .where(eq(irrigationSchedules.id, input.scheduleId));
  }

  revalidatePath('/app/compliance/irrigation');
  revalidatePath('/app/compliance/irrigation/log');
  return { ok: true, id: row!.id };
}

/** Mark planned schedules that have passed without a logged event as 'missed'. */
export async function detectMissedSlots(): Promise<{ marked: number }> {
  const now = new Date();
  const result = await db.execute(sql`
    update zameen.irrigation_schedules
    set status = 'missed'
    where status = 'planned'
      and scheduled_for < ${now}
      and completed_event_id is null
    returning id
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
  return { marked: rows.length };
}
