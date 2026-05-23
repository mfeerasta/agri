import Link from 'next/link';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import {
  db, weatherRecords, cropPlans, fields, blocks, farms,
  irrigationEvents, irrigationSchedules,
} from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

const CROP_MOISTURE_THRESHOLDS: Record<string, number> = {
  wheat: 0.20,
  maize: 0.22,
  cotton: 0.18,
  rice: 0.30,
  sugarcane: 0.22,
  default: 0.20,
};

function thresholdFor(cropName: string | null | undefined): number {
  if (!cropName) return CROP_MOISTURE_THRESHOLDS.default;
  return CROP_MOISTURE_THRESHOLDS[cropName.toLowerCase()] ?? CROP_MOISTURE_THRESHOLDS.default;
}

export default async function IrrigationPlannerPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const today = new Date().toISOString().slice(0, 10);

  const wx = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, ctx.entityId), gte(weatherRecords.recordedFor, today)))
    .orderBy(desc(weatherRecords.recordedFor))
    .limit(7);

  const sortedWx = [...wx].sort((a, b) => String(a.recordedFor).localeCompare(String(b.recordedFor)));
  const todayWx = sortedWx[0];
  const et0Next3 = sortedWx.slice(0, 3).reduce((a, b) => a + Number(b.et0Mm ?? 0), 0);
  const rainNext3 = sortedWx.slice(0, 3).reduce((a, b) => a + Number(b.rainfallMm ?? 0), 0);

  const plans = await db
    .select({
      planId: cropPlans.id,
      cropName: cropPlans.cropName,
      fieldId: cropPlans.fieldId,
      fieldName: fields.name,
    })
    .from(cropPlans)
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .where(and(eq(cropPlans.entityId, ctx.entityId), eq(cropPlans.status, 'active')));

  // KPIs: load last 30 days of events + schedules
  const farmIds = (await db.select({ id: farms.id }).from(farms).where(eq(farms.entityId, ctx.entityId))).map((r) => r.id);
  const entityFieldIds = farmIds.length
    ? (await db.select({ id: fields.id }).from(fields).innerJoin(blocks, eq(blocks.id, fields.blockId)).where(inArray(blocks.farmId, farmIds))).map((r) => r.id)
    : [];

  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const events30 = entityFieldIds.length
    ? await db.select().from(irrigationEvents).where(and(
        inArray(irrigationEvents.fieldId, entityFieldIds),
        gte(irrigationEvents.startedAt, thirtyAgo),
      ))
    : [];
  const schedules30 = entityFieldIds.length
    ? await db.select().from(irrigationSchedules).where(and(
        inArray(irrigationSchedules.fieldId, entityFieldIds),
        gte(irrigationSchedules.scheduledFor, thirtyAgo),
      ))
    : [];

  const totalVolumeM3 = events30.reduce((a, e) => a + Number(e.estimatedVolumeM3 ?? 0), 0);
  const totalCostPkr = events30.reduce((a, e) => a + Number(e.costPkr ?? 0), 0);
  const missedCount = schedules30.filter((s) => s.status === 'missed').length;
  const completedCount = schedules30.filter((s) => s.status === 'completed').length;
  const plannedTotal = schedules30.length;
  const onTimePct = plannedTotal > 0 ? Math.round((completedCount / plannedTotal) * 100) : 0;

  // Sparkline per field: last 30d events count
  const eventsByField = new Map<string, number[]>();
  for (const e of events30) {
    const arr = eventsByField.get(e.fieldId) ?? Array(30).fill(0);
    const dayIdx = Math.max(0, Math.min(29, Math.floor((Date.now() - new Date(e.startedAt).getTime()) / (24 * 3600 * 1000))));
    arr[29 - dayIdx] = (arr[29 - dayIdx] ?? 0) + 1;
    eventsByField.set(e.fieldId, arr);
  }

  return (
    <div>
      <Masthead section="IRRIGATION PLANNER" />
      <SectionDivider />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className="rounded border border-[var(--rule)] px-3 py-1 hover:bg-[var(--rule)]/30" href="/app/compliance/warabandi">Warabandi grid</Link>
        <Link className="rounded border border-[var(--rule)] px-3 py-1 hover:bg-[var(--rule)]/30" href="/app/compliance/irrigation/schedule">Schedule planner</Link>
        <Link className="rounded border border-[var(--rule)] px-3 py-1 hover:bg-[var(--rule)]/30" href="/app/compliance/irrigation/log">Log event</Link>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>KPIs (last 30 days)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          <div>
            <div className="smallcaps text-[0.65rem]">Volume applied</div>
            <div className="tabular text-2xl">{totalVolumeM3.toFixed(0)} m³</div>
          </div>
          <div>
            <div className="smallcaps text-[0.65rem]">Irrigation cost</div>
            <div className="tabular text-2xl">{totalCostPkr.toLocaleString()} PKR</div>
          </div>
          <div>
            <div className="smallcaps text-[0.65rem]">On-time %</div>
            <div className="tabular text-2xl">{onTimePct}%</div>
          </div>
          <div>
            <div className="smallcaps text-[0.65rem]">Missed slots</div>
            <div className="tabular text-2xl text-red-600">{missedCount}</div>
          </div>
        </CardContent>
      </Card>


      <Card className="mb-4">
        <CardHeader>
          <CardTitle>3-day outlook</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 p-4">
          <div>
            <div className="smallcaps text-[0.65rem]">ET0 demand</div>
            <div className="tabular text-2xl">{et0Next3.toFixed(1)} mm</div>
          </div>
          <div>
            <div className="smallcaps text-[0.65rem]">Rain forecast</div>
            <div className="tabular text-2xl">{rainNext3.toFixed(1)} mm</div>
          </div>
          <div>
            <div className="smallcaps text-[0.65rem]">Soil moisture (0-10cm)</div>
            <div className="tabular text-2xl">
              {Number(todayWx?.soilMoisture0to10 ?? 0).toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-field recommendations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No active crop plans.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  <th className="p-2">Field</th>
                  <th className="p-2">Crop</th>
                  <th className="p-2">Threshold</th>
                  <th className="p-2">Current</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">30d events</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const t = thresholdFor(p.cropName);
                  const current = Number(todayWx?.soilMoisture0to10 ?? 0);
                  const irrigate = current < t && et0Next3 > 12 && rainNext3 < 5;
                  const series = p.fieldId ? (eventsByField.get(p.fieldId) ?? []) : [];
                  const max = Math.max(1, ...series);
                  return (
                    <tr key={p.planId} className="border-b border-[var(--rule)]">
                      <td className="p-2">{p.fieldName ?? '-'}</td>
                      <td className="p-2">{p.cropName ?? '-'}</td>
                      <td className="tabular p-2">{t.toFixed(2)}</td>
                      <td className="tabular p-2">{current.toFixed(2)}</td>
                      <td className="p-2">
                        {irrigate ? (
                          <span className="text-red-600">Irrigate within 24h</span>
                        ) : (
                          <span className="text-emerald-700">Hold</span>
                        )}
                      </td>
                      <td className="p-2">
                        <svg width="90" height="20" viewBox="0 0 90 20">
                          {series.map((v, i) => (
                            <rect key={i} x={i * 3} y={20 - (v / max) * 18} width={2} height={(v / max) * 18} fill="#2563eb" />
                          ))}
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
