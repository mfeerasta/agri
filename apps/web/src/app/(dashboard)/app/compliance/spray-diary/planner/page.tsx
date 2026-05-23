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
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const wx = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, ctx.entityId), gte(weatherRecords.recordedFor, fromIso)))
    .orderBy(desc(weatherRecords.recordedFor))
    .limit(16);

  const wxHistory = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, ctx.entityId), gte(weatherRecords.recordedFor, thirtyDaysAgoIso)))
    .orderBy(desc(weatherRecords.recordedFor))
    .limit(60);

  const sortedWx = [...wx].sort((a, b) => String(a.recordedFor).localeCompare(String(b.recordedFor)));
  const next7 = sortedWx.slice(0, 7);
  const next72hFrost = next7.slice(0, 3).reduce((acc, w) => acc + Number(w.frostHours ?? 0), 0);

  const cropPlanOptions = await listCropPlanOptions();

  return (
    <div>
      <Masthead section="SPRAY PLANNER" />
      <SectionDivider />

      {next72hFrost > 0 ? (
        <Card className="mb-4 border-red-600">
          <CardContent className="p-3 text-sm text-red-700">
            Frost risk: {next72hFrost} hour(s) below 2C forecast in next 72h. Consider protective irrigation or covers.
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>16-day forecast</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedWx.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">
              No weather data. The weather-puller cron runs every 3 hours.
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto p-3">
              {sortedWx.map((w) => {
                const rain = Number(w.rainfallMm ?? 0);
                const icon = rain > 5 ? '☔' : rain > 0 ? '☂' : '☀';
                return (
                  <div
                    key={w.id}
                    className="min-w-[120px] border border-[var(--rule)] p-2 text-center"
                  >
                    <div className="smallcaps text-[0.65rem]">{String(w.recordedFor).slice(5)}</div>
                    <div className="text-2xl">{icon}</div>
                    <div className="tabular text-xs">
                      {Number(w.minTempC ?? 0).toFixed(0)}/{Number(w.maxTempC ?? 0).toFixed(0)} C
                    </div>
                    <div className="tabular text-[0.65rem] text-[var(--ink)]/60">
                      {rain.toFixed(1)} mm · {Number(w.windKph ?? 0).toFixed(0)} kph
                    </div>
                    <div className="tabular text-[0.65rem] text-[var(--ink)]/60">
                      ET0 {Number(w.et0Mm ?? 0).toFixed(1)} mm
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>ET0 next 7 days (irrigation demand)</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-end gap-1">
            {next7.map((w) => {
              const et0 = Number(w.et0Mm ?? 0);
              const height = Math.min(80, Math.max(4, et0 * 8));
              return (
                <div key={w.id} className="flex flex-col items-center" style={{ width: 48 }}>
                  <div className="bg-blue-500" style={{ width: 24, height }} />
                  <div className="tabular text-[0.65rem]">{et0.toFixed(1)}</div>
                  <div className="smallcaps text-[0.6rem]">{String(w.recordedFor).slice(5)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Soil moisture trend (30d, 0-10cm m3/m3)</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-end gap-1">
            {[...wxHistory].reverse().map((w) => {
              const m = Number(w.soilMoisture0to10 ?? 0);
              const height = Math.min(80, Math.max(2, m * 200));
              return (
                <div key={w.id} className="bg-emerald-600" style={{ width: 6, height }} title={String(w.recordedFor)} />
              );
            })}
          </div>
        </CardContent>
      </Card>

      <SprayPlannerClient cropPlanOptions={cropPlanOptions} />
    </div>
  );
}
