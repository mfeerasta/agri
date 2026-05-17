import { db, journalEntries } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  const rows = await db.select().from(journalEntries).orderBy(desc(journalEntries.postedOn)).limit(200);
  return (
    <div>
      <Masthead section="JOURNAL" />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Recent entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No journal entries yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">No.</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Posted</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Narration</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Source</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Debit</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{j.journalNumber}</td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(j.postedOn)}</td>
                    <td className="px-3 py-2">{j.narration}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{j.sourceModule ?? '—'}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={j.totalDebitPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={j.totalCreditPkr} /></td>
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
