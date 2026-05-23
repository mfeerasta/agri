import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, EmptyState } from '@zameen/ui';
import { computeArAging, AGE_BUCKETS } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ArAgingDashboard({
  searchParams,
}: {
  searchParams: Promise<{ asOfDate?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;
  const asOfDate = sp.asOfDate ?? new Date().toISOString().slice(0, 10);

  const report = entityId
    ? await computeArAging({ entityId, asOfDate })
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Masthead section="Accounts receivable aging" />

      <div className="flex flex-wrap items-center gap-4">
        <form className="flex items-center gap-2">
          <label className="smallcaps text-xs">as of</label>
          <input
            type="date"
            name="asOfDate"
            defaultValue={asOfDate}
            className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1 text-sm"
          />
          <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-1 text-xs text-[var(--paper)]">
            refresh
          </button>
        </form>
        <a href="/finance/ar/invoices" className="smallcaps text-xs underline">invoices</a>
        <a href="/finance/ar/receipts/new" className="smallcaps text-xs underline">record receipt</a>
        <a href="/finance/ar/credit-limits" className="smallcaps text-xs underline">credit limits</a>
        <a href="/finance/ar/disputes" className="smallcaps text-xs underline">disputes</a>
      </div>

      {!report || report.buyers.length === 0 ? (
        <EmptyState title="No outstanding receivables" hint="Create an invoice to get started." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Total outstanding</CardTitle></CardHeader>
              <CardContent><div className="tabular text-2xl"><Pkr value={report.grandTotalOutstandingPkr} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Bad-debt provision</CardTitle></CardHeader>
              <CardContent><div className="tabular text-2xl text-rose-700"><Pkr value={report.grandTotalBadDebtProvisionPkr} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Buyers w/ open AR</CardTitle></CardHeader>
              <CardContent><div className="tabular text-2xl">{report.buyers.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">{'>'}90d aging</CardTitle></CardHeader>
              <CardContent>
                <div className="tabular text-2xl text-rose-700">
                  <Pkr value={report.totals['91-180'] + report.totals['>180']} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Aging matrix by buyer</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="smallcaps text-xs text-[var(--zameen-600)]">
                    <th className="text-left">Buyer</th>
                    {AGE_BUCKETS.map((b) => (
                      <th key={b} className="text-right">{b}</th>
                    ))}
                    <th className="text-right">Total</th>
                    <th className="text-right">Credit limit</th>
                    <th className="text-right">Util %</th>
                    <th className="text-right">Provision</th>
                  </tr>
                </thead>
                <tbody>
                  {report.buyers.map((b) => (
                    <tr key={b.buyerId} className="border-b border-[var(--paper-2)]">
                      <td className="font-mono text-xs">{b.buyerId.slice(0, 8)}</td>
                      {AGE_BUCKETS.map((bk) => (
                        <td key={bk} className="tabular text-right">
                          {b.buckets[bk] > 0 ? <Pkr value={b.buckets[bk]} /> : '-'}
                        </td>
                      ))}
                      <td className="tabular text-right font-semibold"><Pkr value={b.totalOutstandingPkr} /></td>
                      <td className="tabular text-right">
                        {b.creditLimitPkr != null ? <Pkr value={b.creditLimitPkr} /> : '-'}
                      </td>
                      <td className={`tabular text-right ${b.creditUtilizationPct && b.creditUtilizationPct > 90 ? 'text-rose-700' : ''}`}>
                        {b.creditUtilizationPct != null ? b.creditUtilizationPct.toFixed(0) + '%' : '-'}
                      </td>
                      <td className="tabular text-right text-rose-700">
                        {b.badDebtProvisionPkr > 0 ? <Pkr value={b.badDebtProvisionPkr} /> : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--zameen-700)] font-semibold">
                    <td className="smallcaps text-xs">totals</td>
                    {AGE_BUCKETS.map((bk) => (
                      <td key={bk} className="tabular text-right"><Pkr value={report.totals[bk]} /></td>
                    ))}
                    <td className="tabular text-right"><Pkr value={report.grandTotalOutstandingPkr} /></td>
                    <td colSpan={2}></td>
                    <td className="tabular text-right text-rose-700"><Pkr value={report.grandTotalBadDebtProvisionPkr} /></td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
