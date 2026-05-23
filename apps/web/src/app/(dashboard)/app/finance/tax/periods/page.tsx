import { db, taxPeriods, TAX_KIND_LABELS, type TaxKind } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TaxPeriodsPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string }> }) {
  const sp = await searchParams;
  const rows = await db.select().from(taxPeriods).orderBy(desc(taxPeriods.dueOn)).limit(500);
  const filtered = rows.filter((r) => (!sp.kind || r.taxKind === sp.kind) && (!sp.status || r.filingStatus === sp.status));
  const computedTotal = filtered.reduce((a, r) => a + Number(r.computedAmountPkr ?? 0), 0);
  const paidTotal = filtered.reduce((a, r) => a + Number(r.paidAmountPkr ?? 0), 0);

  return (
    <div>
      <Masthead section="TAX PERIODS" />
      <SectionDivider />
      <div className="mb-3 flex justify-between smallcaps text-xs text-[var(--ink)]/70">
        <span>{filtered.length} rows</span>
        <span>Computed <Pkr value={computedTotal} mode="lac_crore" /> · Paid <Pkr value={paidTotal} mode="lac_crore" /></span>
      </div>
      <Card>
        <CardHeader><CardTitle>All filings</CardTitle></CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No tax periods recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Due</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Period</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Computed</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Paid</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Challan</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.dueOn)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{TAX_KIND_LABELS[r.taxKind as TaxKind] ?? r.taxKind}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.filingStatus}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.computedAmountPkr ?? 0} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.paidAmountPkr ?? 0} /></td>
                    <td className="px-3 py-2 font-mono text-xs">{r.challanNumber ?? '—'}</td>
                    <td className="px-3 py-2">
                      <form action={`/api/finance/tax/${r.id}/challan`} method="post">
                        <button type="submit" className="px-2 py-1 text-xs border rounded bg-[var(--ink)] text-white">
                          Generate challan
                        </button>
                      </form>
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
