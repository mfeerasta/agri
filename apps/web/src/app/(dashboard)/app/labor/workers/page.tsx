import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, workers } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WorkersListPage() {
  const rows = await db.select().from(workers).orderBy(desc(workers.hireDate)).limit(200);
  return (
    <div>
      <Masthead section="WORKERS" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">Roster · {rows.length}</div>
        <Link href={'/labor/workers/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Hire worker</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>All workers</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No workers yet. Run db:seed or add the first.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Code</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Type</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Rate</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Hired</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{w.code}</td>
                    <td className="px-3 py-2">
                      <Link href={`/labor/workers/${w.id}` as never} className="hover:underline">
                        {w.fullName}{w.fullNameUr ? <span className="urdu mx-2 opacity-60">{w.fullNameUr}</span> : null}
                      </Link>
                    </td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{w.workerType}</td>
                    <td className="px-3 py-2 text-right">
                      {w.monthlySalaryPkr ? <><Pkr value={w.monthlySalaryPkr} /> <span className="text-xs opacity-60">/ mo</span></> : null}
                      {w.dailyWagePkr ? <><Pkr value={w.dailyWagePkr} /> <span className="text-xs opacity-60">/ day</span></> : null}
                    </td>
                    <td className="px-3 py-2 tabular text-xs">{fmtDate(w.hireDate)}</td>
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
