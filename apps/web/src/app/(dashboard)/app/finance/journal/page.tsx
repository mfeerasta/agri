import Link from 'next/link';
import { db, journalEntries } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { ExportButtons } from '@/components/export-buttons';

export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  const rows = await db.select().from(journalEntries).orderBy(desc(journalEntries.postedOn)).limit(200);
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);
  const from = monthAgo.toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Masthead section="JOURNAL" />
        <ExportButtons
          endpoint="/api/exports/journal-entries"
          query={{ from, to }}
          formats={['xlsx']}
          label="Export last 30d"
        />
      </div>
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
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Audit</th>
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
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/audit/journal_entry/${j.id}` as never}
                        className="smallcaps text-[0.7rem] text-[var(--ochre)] hover:underline"
                      >
                        walk
                      </Link>
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
