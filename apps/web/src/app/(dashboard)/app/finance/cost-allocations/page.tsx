import { db, costAllocations } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CostAllocationsPage() {
  const rows = await db.select().from(costAllocations).orderBy(desc(costAllocations.allocatedOn)).limit(300);
  const total = rows.reduce((a, r) => a + Number(r.amountPkr), 0);
  return (
    <div>
      <Masthead section="COST ALLOCATIONS" />
      <SectionDivider />
      <div className="mb-3 flex justify-between smallcaps text-xs text-[var(--ink)]/70">
        <span>{rows.length} rows</span>
        <span>Total <Pkr value={total} mode="lac_crore" /></span>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent allocations</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No allocations yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Date</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Source</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pool</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(r.allocatedOn)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.sourceModule}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.costPool}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.fieldId ? r.fieldId.slice(0, 8) : '—'}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.amountPkr} /></td>
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
