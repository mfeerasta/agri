import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { computeWorkshopScores } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function toneFor(pct: number): string {
  if (pct >= 85) return 'var(--success)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

export default async function WorkshopsPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return (
      <div>
        <Masthead section="WORKSHOP SCORECARD" />
        <SectionDivider />
        <Card>
          <CardContent className="p-6 text-sm text-[var(--fg-muted)]">Sign in to view scorecard.</CardContent>
        </Card>
      </div>
    );
  }
  const scores = await computeWorkshopScores(ctx.entityId);

  return (
    <div>
      <Masthead section="WORKSHOP SCORECARD" />
      <SectionDivider />
      <div className="smallcaps text-xs text-[var(--fg-muted)] mb-3">
        {scores.length} workshops scored
      </div>
      <Card>
        <CardContent className="p-0">
          {scores.length === 0 ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">No repair activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Workshop</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Repairs</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Spend (PKR)</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Quote accuracy</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">ETA slip (days)</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Warranty fail %</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.workshopName} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{s.workshopName}</td>
                    <td className="px-3 py-2 text-right tabular">{s.repairCount}</td>
                    <td className="px-3 py-2 text-right tabular">{s.totalSpendPkr.toLocaleString('en-PK')}</td>
                    <td
                      className="px-3 py-2 text-right tabular font-semibold"
                      style={{ color: toneFor(s.avgQuoteAccuracyPct) }}
                    >
                      {s.avgQuoteAccuracyPct.toFixed(1)}%
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular"
                      style={{ color: s.avgEtaAccuracyDays > 2 ? 'var(--warning)' : undefined }}
                    >
                      {s.avgEtaAccuracyDays.toFixed(1)}
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular"
                      style={{ color: s.warrantyFailureRate > 10 ? 'var(--danger)' : undefined }}
                    >
                      {s.warrantyFailureRate.toFixed(1)}%
                    </td>
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
