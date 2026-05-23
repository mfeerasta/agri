import { and, desc, eq, gte } from 'drizzle-orm';
import { db, climateNormals, weatherRecords } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function ClimateNormalsPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const [normal] = await db
    .select()
    .from(climateNormals)
    .where(eq(climateNormals.entityId, ctx.entityId))
    .orderBy(desc(climateNormals.computedAt))
    .limit(1);

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const ytd = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, ctx.entityId), gte(weatherRecords.recordedFor, yearStart)));

  const ytdMonthlyTemp = new Array<number>(12).fill(0);
  const ytdMonthlyTempCount = new Array<number>(12).fill(0);
  const ytdMonthlyRain = new Array<number>(12).fill(0);
  for (const r of ytd) {
    const m = Number(String(r.recordedFor).slice(5, 7)) - 1;
    const t = (Number(r.minTempC ?? 0) + Number(r.maxTempC ?? 0)) / 2;
    if (Number.isFinite(t)) {
      ytdMonthlyTemp[m] += t;
      ytdMonthlyTempCount[m] += 1;
    }
    ytdMonthlyRain[m] += Number(r.rainfallMm ?? 0);
  }
  const ytdAvgTemp = ytdMonthlyTemp.map((s, i) => (ytdMonthlyTempCount[i] > 0 ? s / ytdMonthlyTempCount[i] : 0));

  if (!normal) {
    return (
      <div>
        <Masthead section="CLIMATE NORMALS" />
        <SectionDivider />
        <div className="p-6 text-sm text-[var(--ink)]/60">
          No 40-year normals computed yet. The weather-puller refreshes these from NASA POWER once per quarter.
        </div>
      </div>
    );
  }

  const baselineTemp = normal.monthlyMeanTempC.map((v) => Number(v));
  const baselineRain = normal.monthlyTotalRainMm.map((v) => Number(v));
  const baselineEt0 = normal.monthlyEt0Mm.map((v) => Number(v));

  const anomalies: Array<{ month: string; delta: number }> = [];
  for (let i = 0; i < 12; i += 1) {
    if (ytdMonthlyTempCount[i] === 0) continue;
    const delta = ytdAvgTemp[i] - baselineTemp[i];
    if (Math.abs(delta) >= 1.5) {
      anomalies.push({ month: MONTHS[i], delta });
    }
  }

  return (
    <div>
      <Masthead section="CLIMATE NORMALS" />
      <SectionDivider />

      <div className="p-3 text-xs text-[var(--ink)]/60">
        Baseline: {normal.startYear}-{normal.endYear} from NASA POWER. Current year overlay shows YTD averages.
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Monthly mean temperature C</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {MONTHS.map((m) => <th key={m} className="p-1">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                {baselineTemp.map((v, i) => (
                  <td key={`b-${i}`} className="tabular p-1 text-center">{v.toFixed(1)}</td>
                ))}
              </tr>
              <tr className="border-t border-[var(--rule)]">
                {ytdAvgTemp.map((v, i) => (
                  <td key={`y-${i}`} className="tabular p-1 text-center text-emerald-700">
                    {ytdMonthlyTempCount[i] > 0 ? v.toFixed(1) : '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Monthly rainfall mm</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-12 gap-1">
            {baselineRain.map((v, i) => (
              <div key={i} className="text-center">
                <div className="bg-blue-400" style={{ height: Math.min(80, Math.max(2, v)) }} />
                <div className="tabular text-[0.6rem]">{v.toFixed(0)}</div>
                <div className="smallcaps text-[0.55rem]">{MONTHS[i]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Monthly ET0 mm</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-12 gap-1">
            {baselineEt0.map((v, i) => (
              <div key={i} className="text-center">
                <div className="bg-orange-400" style={{ height: Math.min(80, Math.max(2, v / 3)) }} />
                <div className="tabular text-[0.6rem]">{v.toFixed(0)}</div>
                <div className="smallcaps text-[0.55rem]">{MONTHS[i]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {anomalies.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Anomalies vs 40-year mean</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ul className="space-y-1 text-sm">
              {anomalies.map((a) => (
                <li key={a.month}>
                  {a.month} {new Date().getFullYear()} was {a.delta > 0 ? '+' : ''}{a.delta.toFixed(1)}C
                  {' '}vs {normal.startYear}-{normal.endYear} mean
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
