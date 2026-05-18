import { and, desc, eq, gte } from 'drizzle-orm';
import { db, weatherRecords } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listCropPlanOptions } from '@/modules/compliance/spray-planner-actions';
import { SprayPlannerClient } from '@/modules/compliance/spray-planner-client';

export const dynamic = 'force-dynamic';

export default async function SprayPlannerPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const fromIso = new Date().toISOString().slice(0, 10);
  const wx = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, ctx.entityId), gte(weatherRecords.recordedFor, fromIso)))
    .orderBy(desc(weatherRecords.recordedFor))
    .limit(7);

  const cropPlanOptions = await listCropPlanOptions();

  return (
    <div>
      <Masthead section="SPRAY PLANNER" />
      <SectionDivider />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>7-day forecast</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {wx.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">
              No weather data. The weather-puller cron runs every 3 hours.
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto p-3">
              {wx
                .slice()
                .sort((a, b) => String(a.recordedFor).localeCompare(String(b.recordedFor)))
                .map((w) => {
                  const rain = Number(w.rainfallMm ?? 0);
                  const icon = rain > 5 ? '☔' : rain > 0 ? '☂' : '☀';
                  return (
                    <div
                      key={w.id}
                      className="min-w-[110px] border border-[var(--rule)] p-2 text-center"
                    >
                      <div className="smallcaps text-[0.65rem]">{String(w.recordedFor).slice(5)}</div>
                      <div className="text-2xl">{icon}</div>
                      <div className="tabular text-xs">
                        {Number(w.minTempC ?? 0).toFixed(0)}/{Number(w.maxTempC ?? 0).toFixed(0)} C
                      </div>
                      <div className="tabular text-[0.65rem] text-[var(--ink)]/60">
                        {rain.toFixed(1)} mm · {Number(w.windKph ?? 0).toFixed(0)} kph
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <SprayPlannerClient cropPlanOptions={cropPlanOptions} />
    </div>
  );
}
