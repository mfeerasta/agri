import { db, subsidyTransactions } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SubsidiesPage() {
  const rows = await db.select().from(subsidyTransactions).orderBy(desc(subsidyTransactions.applicationDate)).limit(100);
  return (
    <div>
      <Masthead section="SUBSIDIES" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <div className="p-6 text-sm text-[var(--ink)]/50">No subsidies.</div> : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Program</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Applied</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Amount</th>
              </tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{s.programName}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(s.applicationDate)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{s.status}</td>
                    <td className="px-3 py-2 text-right">{s.amountPkr ? <Pkr value={s.amountPkr} /> : '—'}</td>
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
