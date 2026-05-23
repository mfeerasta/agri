import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, StatBlock } from '@zameen/ui';
import { getDb } from '@zameen/db';
import { locustAlerts } from '@zameen/db/schema';
import { desc, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function stageAdvisory(stage: string): string {
  if (stage === 'gregarious') return 'Immediate threat. Coordinate spray crews and DPP.';
  if (stage === 'transient') return 'Watch. Stage between solitary and gregarious. Inspect daily.';
  return 'No immediate action. Standard scouting cadence is fine.';
}

export default async function LocustWatchPage(): Promise<JSX.Element> {
  const db = getDb();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(locustAlerts)
    .where(gte(locustAlerts.reportedOn, cutoff))
    .orderBy(desc(locustAlerts.reportedOn))
    .limit(200);

  const nearestGregarious = rows
    .filter((r) => r.swarmStage === 'gregarious')
    .sort((a, b) => Number(a.distanceKm ?? 9999) - Number(b.distanceKm ?? 9999))[0];

  const last30 = rows.filter(
    (r) => r.reportedOn >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  ).length;

  return (
    <div>
      <Masthead section="Locust watch" />
      <SectionDivider />
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-[var(--rule)]">
        <StatBlock
          label="Nearest gregarious swarm"
          value={nearestGregarious ? `${Number(nearestGregarious.distanceKm ?? 0).toFixed(0)} km` : 'none'}
          caption={nearestGregarious?.region ?? nearestGregarious?.country ?? ''}
        />
        <StatBlock label="Reports (last 30 days)" value={String(last30)} caption="within 500km" />
        <StatBlock label="Reports (last 90 days)" value={String(rows.length)} caption="all stages" />
      </div>
      <SectionDivider label="Recent reports" />
      <Card>
        <CardHeader>
          <CardTitle>FAO Locust Hub feed</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--ink)]/60">No swarm reports recorded yet. The weekly poller runs every Sunday.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left smallcaps text-[0.7rem] text-[var(--ink)]/60">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Stage</th>
                  <th className="py-1 pr-2">Size</th>
                  <th className="py-1 pr-2">Distance</th>
                  <th className="py-1 pr-2">Country / Region</th>
                  <th className="py-1 pr-2">Advisory</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="py-1 pr-2 font-mono">{r.reportedOn}</td>
                    <td className="py-1 pr-2 capitalize">{r.swarmStage}</td>
                    <td className="py-1 pr-2 capitalize">{r.size ?? '-'}</td>
                    <td className="py-1 pr-2 font-mono">{Number(r.distanceKm ?? 0).toFixed(0)} km</td>
                    <td className="py-1 pr-2">{r.region ?? r.country}</td>
                    <td className="py-1 pr-2 text-xs text-[var(--ink)]/70">{stageAdvisory(r.swarmStage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Suppress unused-import warning when JSX namespace isn't auto-resolved.
void sql;
