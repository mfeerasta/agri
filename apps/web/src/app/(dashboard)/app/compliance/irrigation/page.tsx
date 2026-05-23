import { and, desc, eq, gte } from 'drizzle-orm';
import { db, weatherRecords, cropPlans, fields } from '@zameen/db';
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

  return (
    <div>
      <Masthead section="IRRIGATION PLANNER" />
      <SectionDivider />

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
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const t = thresholdFor(p.cropName);
                  const current = Number(todayWx?.soilMoisture0to10 ?? 0);
                  const irrigate = current < t && et0Next3 > 12 && rainNext3 < 5;
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
