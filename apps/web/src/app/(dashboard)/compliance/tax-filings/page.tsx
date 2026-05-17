import { db, taxFilings } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TaxFilingsPage() {
  const rows = await db.select().from(taxFilings).orderBy(desc(taxFilings.filedOn)).limit(100);
  return (
    <div>
      <Masthead section="TAX FILINGS" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Filings</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No filings.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Period</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Filed</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Challan</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Amount</th>
              </tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{t.taxKind}</td>
                    <td className="px-3 py-2">{t.periodLabel}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(t.filedOn)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{t.challanNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={t.amountPkr} /></td>
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
