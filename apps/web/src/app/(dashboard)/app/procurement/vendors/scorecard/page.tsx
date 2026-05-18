import Link from 'next/link';
import { Masthead, SectionDivider, Card, CardContent } from '@zameen/ui';
import { computeVendorScores } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function toneFor(pct: number): string {
  if (pct >= 85) return 'var(--success)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

export default async function VendorScorecardPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return (
      <div>
        <Masthead section="VENDOR SCORECARD" />
        <SectionDivider />
        <Card>
          <CardContent className="p-6 text-sm text-[var(--fg-muted)]">Sign in to view scorecard.</CardContent>
        </Card>
      </div>
    );
  }
  const scores = await computeVendorScores(ctx.entityId);

  return (
    <div>
      <Masthead section="VENDOR SCORECARD" />
      <SectionDivider />
      <div className="smallcaps text-xs text-[var(--fg-muted)] mb-3">
        {scores.length} vendors scored
      </div>
      <Card>
        <CardContent className="p-0">
          {scores.length === 0 ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">No vendor activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Vendor</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Spend (PKR)</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">POs</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">On-time %</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Quote accuracy</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">QC fail %</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Avg days to pay</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.vendorId} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">
                      <Link
                        href={`/procurement/vendors/${s.vendorId}` as never}
                        className="hover:underline"
                      >
                        {s.vendorName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{s.totalSpendPkr.toLocaleString('en-PK')}</td>
                    <td className="px-3 py-2 text-right tabular">{s.orderCount}</td>
                    <td
                      className="px-3 py-2 text-right tabular font-semibold"
                      style={{ color: toneFor(s.onTimeDeliveryPct) }}
                    >
                      {s.onTimeDeliveryPct.toFixed(1)}%
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular font-semibold"
                      style={{ color: toneFor(s.avgQuoteAccuracyPct) }}
                    >
                      {s.avgQuoteAccuracyPct.toFixed(1)}%
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular"
                      style={{ color: s.qcFailRate > 5 ? 'var(--danger)' : undefined }}
                    >
                      {s.qcFailRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular">{s.daysToPayAvg.toFixed(1)}</td>
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
