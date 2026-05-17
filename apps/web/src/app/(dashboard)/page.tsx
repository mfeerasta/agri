import { db, fields, cropPlans, cropProfiles, dieselAnomalies } from '@zameen/db';
import { eq, count } from 'drizzle-orm';
import {
  Masthead,
  SectionDivider,
  StatBlock,
  Card,
  CardContent,
  Pkr,
  ChartCard,
  FieldMap,
} from '@zameen/ui';

export const dynamic = 'force-dynamic';

const DIESEL_30D = [
  { day: 'Apr 18', litres: 142 },
  { day: 'Apr 25', litres: 168 },
  { day: 'May 02', litres: 195 },
  { day: 'May 09', litres: 184 },
  { day: 'May 16', litres: 211 },
];

const TODAY_TASKS = [
  { code: 'F3', title: 'Apply urea top-dress', crew: 'Akram + 3' },
  { code: 'F7', title: 'Aphid scouting walk', crew: 'Shahid' },
  { code: 'F11', title: 'Berseem cut 2', crew: 'Yousaf + 5' },
  { code: 'F2', title: 'Tubewell 1 service', crew: 'Mechanic Imran' },
];

const CROP_PALETTE: Record<string, string> = {
  wheat: '#E5B25D',
  maize: '#F2B84B',
  cotton: '#F4F1EA',
  rice: '#7FB069',
  berseem: '#2D6A4F',
  sugarcane: '#74C69D',
  fodder: '#52B788',
};

function colorFor(cropName: string | null): string {
  if (!cropName) return '#4B5563';
  const key = cropName.toLowerCase();
  for (const [k, v] of Object.entries(CROP_PALETTE)) {
    if (key.includes(k)) return v;
  }
  return '#22D3EE';
}

export default async function DashboardHome() {
  const rows = await db
    .select({
      id: fields.id,
      code: fields.code,
      acres: fields.acres,
      geometry: fields.geometry,
    })
    .from(fields)
    .orderBy(fields.code)
    .limit(4);

  const [openAnom] = await db
    .select({ n: count() })
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.status, 'open'));
  const [critAnom] = await db
    .select({ n: count() })
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.severity, 'critical'));
  const openAnomalies = Number(openAnom?.n ?? 0);
  const criticalAnomalies = Number(critAnom?.n ?? 0);

  const plans = await db
    .select({
      fieldId: cropPlans.fieldId,
      stage: cropPlans.currentStage,
      cropName: cropProfiles.name,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId));
  const planByField = new Map(plans.map((p) => [p.fieldId, p]));

  return (
    <div>
      <Masthead section="Overview" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Pending approvals" value="3" caption="2 with Farm Manager · 1 with MF" delta={{ value: -1, label: 'vs yesterday' }} />
        <StatBlock label="Workers present" value={<><span>18</span><span className="text-2xl text-[var(--fg-muted)] ml-1">/22</span></>} caption="Geofence-verified" />
        <StatBlock label="Diesel stock" value={<><span>3,420</span><span className="text-xl text-[var(--fg-muted)] ml-1">L</span></>} caption="Main Tank" delta={{ value: 2.1 }} />
        <StatBlock label="Cash on hand" value={<Pkr value={2_840_500} mode="lac_crore" />} caption="Soneri current" delta={{ value: -8.4 }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <StatBlock
          label="Anomalies"
          value={
            <span style={{ color: criticalAnomalies > 0 ? 'var(--danger)' : undefined }}>
              {openAnomalies}
            </span>
          }
          caption={criticalAnomalies > 0 ? `${criticalAnomalies} critical` : 'open diesel anomalies'}
        />
      </div>

      <SectionDivider label="Today" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <ul>
              {TODAY_TASKS.map((t, idx) => (
                <li
                  key={t.code}
                  className={`flex items-baseline justify-between px-5 py-3 ${idx > 0 ? 'border-t border-[var(--border)]' : ''}`}
                >
                  <span className="flex items-baseline gap-3">
                    <span className="smallcaps text-[var(--accent)]">{t.code}</span>
                    <span className="text-[var(--fg)]">{t.title}</span>
                  </span>
                  <span className="tabular text-[0.78rem] text-[var(--fg-muted)]">{t.crew}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <ChartCard
          title="Diesel consumption — last 30 days"
          data={DIESEL_30D}
          xKey="day"
          yKey="litres"
          unit="litres per week"
        />
      </div>

      <SectionDivider label="Field activity" />

      <div className="grid gap-4 md:grid-cols-4">
        {rows.map((r) => {
          const plan = planByField.get(r.id);
          const cropName = plan?.cropName ?? null;
          const color = colorFor(cropName);
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3">
                <div className="smallcaps">{r.code} {cropName ?? 'Fallow'}</div>
                <div className="aspect-[4/3] overflow-hidden rounded-[10px] border border-[var(--border)]">
                  {r.geometry ? (
                    <FieldMap
                      fields={[{
                        id: r.id,
                        code: r.code,
                        geometry: r.geometry as { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown },
                        cropColor: color,
                      }]}
                      height={180}
                      styleUrl="mapbox://styles/mapbox/satellite-streets-v12"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[var(--surface-2)] to-[var(--bg-2)]" />
                  )}
                </div>
                <div className="tabular text-xs text-[var(--fg-muted)]">
                  {Number(r.acres).toFixed(2)} acre · {plan?.stage ?? 'fallow'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--fg-subtle)]">
        <span>Generated by Zameen</span>
        <span className="tabular">{new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}
