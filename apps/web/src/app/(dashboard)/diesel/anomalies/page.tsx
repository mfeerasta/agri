import { db, dieselAnomalies, assets } from '@zameen/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { AnomalyActions } from './anomaly-actions-client';

export const dynamic = 'force-dynamic';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, warning: 2 };
const SEVERITY_TONE: Record<string, string> = {
  critical: 'var(--danger)',
  high: 'var(--warning)',
  warning: 'var(--accent)',
};

export default async function DieselAnomaliesPage() {
  const open = await db
    .select()
    .from(dieselAnomalies)
    .where(eq(dieselAnomalies.status, 'open'))
    .orderBy(desc(dieselAnomalies.detectedOn));

  const assetIds = Array.from(new Set(open.map((a) => a.assetId)));
  const assetRows = assetIds.length
    ? await db.select().from(assets).where(inArray(assets.id, assetIds))
    : [];
  const assetById = new Map(assetRows.map((a) => [a.id, a]));

  const sorted = [...open].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  return (
    <div>
      <Masthead section="DIESEL ANOMALIES" />
      <SectionDivider />
      <div className="smallcaps text-xs text-[var(--fg-muted)] mb-3">
        {sorted.length} open {sorted.length === 1 ? 'anomaly' : 'anomalies'}
      </div>
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-[var(--fg-muted)]">
            No open anomalies. The detector runs nightly at 22:00 PKT.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sorted.map((a) => {
            const asset = assetById.get(a.assetId);
            const tone = SEVERITY_TONE[a.severity] ?? 'var(--accent)';
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-3">
                        <span
                          className="smallcaps text-[0.7rem] px-2 py-0.5 rounded"
                          style={{ background: tone, color: 'var(--paper)' }}
                        >
                          {a.severity}
                        </span>
                        <span className="font-mono text-sm">{asset?.code ?? a.assetId.slice(0, 8)}</span>
                        <span className="text-sm text-[var(--fg)]">
                          {asset?.make ?? ''} {asset?.model ?? ''}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--fg-muted)] tabular mt-1">
                        Detected {a.detectedOn}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold tabular" style={{ color: tone }}>
                        +{Number(a.deviationPct).toFixed(1)}%
                      </div>
                      <div className="text-xs text-[var(--fg-muted)] tabular">
                        {Number(a.observedLph).toFixed(2)} L/hr vs {Number(a.rolling30dAvgLph).toFixed(2)} L/hr
                      </div>
                    </div>
                  </div>
                  <AnomalyActions id={a.id} logId={a.dieselDailyLogId} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
