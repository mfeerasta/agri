'use server';
import { revalidatePath } from 'next/cache';
import { db, attendanceRecords, farms, workers } from '@zameen/db';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getFieldSession } from '../../lib/session';

interface GpsPayload {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: string;
}

type Result = { ok: true; withinGeofence: boolean | null } | { ok: false; error: string };

const EARTH_M = 6_378_137;
function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(s));
}

const GEOFENCE_RADIUS_M = 500;

async function getFarmCentroid(entityId: string): Promise<{ lat: number; lng: number } | null> {
  const rows = await db
    .select({ centroid: farms.centroid })
    .from(farms)
    .where(eq(farms.entityId, entityId))
    .limit(1);
  const c = rows[0]?.centroid as { lat?: number; lng?: number } | null | undefined;
  if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') return null;
  return { lat: c.lat, lng: c.lng };
}

async function getWorkerForUser(userId: string, entityId: string): Promise<string | null> {
  const rows = await db
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.userId, userId), eq(workers.entityId, entityId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function findTodayRecord(workerId: string) {
  const today = todayIso();
  const rows = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, workerId), eq(attendanceRecords.workDate, today)))
    .limit(1);
  return rows[0] ?? null;
}

export async function checkIn(gps: GpsPayload | null): Promise<Result> {
  const session = await getFieldSession();
  if (!session) return { ok: false, error: 'Not authenticated' };
  const workerId = session.workerId ?? (await getWorkerForUser(session.userId, session.entityId));
  if (!workerId) return { ok: false, error: 'Worker record not found' };

  const existing = await findTodayRecord(workerId);
  if (existing && existing.checkInAt) {
    return { ok: true, withinGeofence: existing.withinGeofence };
  }

  let withinGeofence: boolean | null = null;
  if (gps) {
    const centroid = await getFarmCentroid(session.entityId);
    if (centroid) {
      withinGeofence = distance(gps, centroid) <= GEOFENCE_RADIUS_M;
    }
  }

  if (existing) {
    await db
      .update(attendanceRecords)
      .set({
        checkInAt: new Date(),
        checkInGps: gps,
        withinGeofence,
        status: 'present',
      })
      .where(eq(attendanceRecords.id, existing.id));
  } else {
    await db.insert(attendanceRecords).values({
      workerId,
      entityId: session.entityId,
      workDate: todayIso(),
      status: 'present',
      checkInAt: new Date(),
      checkInGps: gps,
      withinGeofence,
      source: 'pwa',
      notes: withinGeofence === false ? 'حد سے باہر چیک ان' : null,
    });
  }

  revalidatePath('/attendance');
  revalidatePath('/');
  return { ok: true, withinGeofence };
}

export async function checkOut(gps: GpsPayload | null): Promise<Result> {
  const session = await getFieldSession();
  if (!session) return { ok: false, error: 'Not authenticated' };
  const workerId = session.workerId ?? (await getWorkerForUser(session.userId, session.entityId));
  if (!workerId) return { ok: false, error: 'Worker record not found' };

  const existing = await findTodayRecord(workerId);
  if (!existing || !existing.checkInAt) {
    return { ok: false, error: 'No active check-in for today' };
  }
  if (existing.checkOutAt) {
    return { ok: true, withinGeofence: existing.withinGeofence };
  }

  let withinGeofence: boolean | null = existing.withinGeofence;
  if (gps) {
    const centroid = await getFarmCentroid(session.entityId);
    if (centroid) {
      withinGeofence = distance(gps, centroid) <= GEOFENCE_RADIUS_M;
    }
  }

  await db
    .update(attendanceRecords)
    .set({
      checkOutAt: new Date(),
      checkOutGps: gps,
      withinGeofence,
    })
    .where(eq(attendanceRecords.id, existing.id));

  revalidatePath('/attendance');
  revalidatePath('/');
  return { ok: true, withinGeofence };
}

export async function fetchMonthAttendance(): Promise<
  { workDate: string; status: string; checkedIn: boolean; checkedOut: boolean }[]
> {
  const session = await getFieldSession();
  if (!session) return [];
  const workerId = session.workerId ?? (await getWorkerForUser(session.userId, session.entityId));
  if (!workerId) return [];

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, workerId),
        gte(attendanceRecords.workDate, start),
        lte(attendanceRecords.workDate, end),
      ),
    );
  return rows.map((r) => ({
    workDate: r.workDate,
    status: r.status,
    checkedIn: !!r.checkInAt,
    checkedOut: !!r.checkOutAt,
  }));
}
