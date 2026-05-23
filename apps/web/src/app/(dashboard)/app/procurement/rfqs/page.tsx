import Link from 'next/link';
import { db, rfqs } from '@zameen/db';
import { desc, eq, and } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
  category?: string;
}

export default async function RfqsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const where = [
    sp.status ? eq(rfqs.status, sp.status) : undefined,
    sp.category ? eq(rfqs.category, sp.category) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(rfqs)
    .where(where.length ? and(...(where as never[])) : undefined)
    .orderBy(desc(rfqs.createdAt))
    .limit(200);

  const STATUSES = ['draft', 'sent', 'quotes_received', 'selected', 'closed', 'cancelled'];

  return (
    <div>
      <Masthead section="REQUESTS FOR QUOTE" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Filter:</span>
          <Link
            href={'/procurement/rfqs' as never}
            className={`smallcaps text-[0.7rem] px-2 py-1 border ${!sp.status ? 'bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule)]'}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/procurement/rfqs?status=${s}` as never}
              className={`smallcaps text-[0.7rem] px-2 py-1 border ${sp.status === s ? 'bg-[var(--ink)] text-[var(--paper)]' : 'border-[var(--rule)]'}`}
            >
              {s.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
        <Link
          href={'/procurement/rfqs/new' as never}
          className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          New RFQ
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} RFQs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No RFQs yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Number</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Title</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Category</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Needed by</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Budget</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)] hover:bg-[var(--paper-2)]">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/procurement/rfqs/${r.id}` as never} className="underline">
                        {r.rfqNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.category}</td>
                    <td className="px-3 py-2 tabular text-xs">{r.neededBy ? fmtDate(r.neededBy) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular text-xs">
                      {r.budgetEstimatePkr ? Number(r.budgetEstimatePkr).toLocaleString('en-PK') : '—'}
                    </td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.status.replace(/_/g, ' ')}</td>
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
