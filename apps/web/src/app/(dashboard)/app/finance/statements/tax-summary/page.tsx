import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { computeTaxUshrZakatSummary } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function TaxUshrZakatSummaryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const ctx = await getSessionContext();
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = sp.from ?? yearAgo;
  const to = sp.to ?? today;

  if (!ctx) {
    return <div className="p-6 text-sm">Not authenticated.</div>;
  }
  const summary = await computeTaxUshrZakatSummary(ctx.entityId, from, to);

  return (
    <div>
      <Masthead section="TAX & USHR/ZAKAT SUMMARY" />
      <SectionDivider />
      <form className="mb-4 flex gap-2 items-end text-sm">
        <label>
          <span className="block smallcaps text-[0.7rem] text-[var(--ink)]/60">From</span>
          <input type="date" name="from" defaultValue={from} className="border rounded px-2 py-1" />
        </label>
        <label>
          <span className="block smallcaps text-[0.7rem] text-[var(--ink)]/60">To</span>
          <input type="date" name="to" defaultValue={to} className="border rounded px-2 py-1" />
        </label>
        <button type="submit" className="px-3 py-1 border rounded bg-[var(--ink)] text-white">Update</button>
      </form>

      <div className="mb-3 grid grid-cols-3 gap-3 text-xs">
        <Card><CardContent><div className="smallcaps text-[var(--ink)]/60">Computed</div><div><Pkr value={summary.totalComputedPkr} mode="lac_crore" /></div></CardContent></Card>
        <Card><CardContent><div className="smallcaps text-[var(--ink)]/60">Paid</div><div><Pkr value={summary.totalPaidPkr} mode="lac_crore" /></div></CardContent></Card>
        <Card><CardContent><div className="smallcaps text-[var(--ink)]/60">Ushr (kg)</div><div className="tabular">{summary.ushrTotalKg.toLocaleString('en-PK')}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>By kind</CardTitle></CardHeader>
        <CardContent className="p-0">
          {summary.rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">Nothing in range.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Count</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Computed</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Paid</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.taxKind} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right tabular">{r.count}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.computedPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.paidPkr} /></td>
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
