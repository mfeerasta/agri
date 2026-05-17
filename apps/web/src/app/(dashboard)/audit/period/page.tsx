import Link from 'next/link';
import { db, journalEntries, journalLines, approvalRequests, costAllocations, accounts } from '@zameen/db';
import { and, gte, lte, eq, desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export default async function AuditPeriodPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const now = new Date();
  const from = parseDate(sp.from, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = parseDate(sp.to, now);
  const fromIso = isoDate(from);
  const toIso = isoDate(to);

  const journals = await db
    .select()
    .from(journalEntries)
    .where(and(gte(journalEntries.postedOn, fromIso), lte(journalEntries.postedOn, toIso)))
    .orderBy(desc(journalEntries.postedOn))
    .limit(50);

  const firstEntryId = journals[0]?.id;
  const lines = firstEntryId
    ? await db
        .select({
          id: journalLines.id,
          debitPkr: journalLines.debitPkr,
          creditPkr: journalLines.creditPkr,
          accountCode: accounts.code,
          accountName: accounts.name,
        })
        .from(journalLines)
        .leftJoin(accounts, eq(accounts.id, journalLines.accountId))
        .where(eq(journalLines.journalEntryId, firstEntryId))
    : [];

  const approvals = await db
    .select()
    .from(approvalRequests)
    .where(and(gte(approvalRequests.createdAt, from), lte(approvalRequests.createdAt, to)))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(50);

  const allocs = await db
    .select()
    .from(costAllocations)
    .where(and(gte(costAllocations.allocatedOn, fromIso), lte(costAllocations.allocatedOn, toIso)))
    .orderBy(desc(costAllocations.allocatedOn))
    .limit(50);

  return (
    <div className="space-y-4">
      <Masthead section={`AUDIT · ${fromIso} → ${toIso}`} />
      <div className="flex items-center gap-3">
        <Link className="text-xs underline" href={`/api/audit/export?format=xlsx&from=${fromIso}&to=${toIso}`}>Export XLSX</Link>
        <Link className="text-xs underline" href={`/api/audit/export?format=pdf&from=${fromIso}&to=${toIso}`}>Export PDF</Link>
      </div>

      <SectionDivider label="Journal entries" />
      <Card>
        <CardHeader><CardTitle>{journals.length} entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Posted</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Number</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Source</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Narration</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Debit</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((j) => (
                <tr key={j.id} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 tabular text-xs">{j.postedOn}</td>
                  <td className="px-3 py-2 tabular text-xs">{j.journalNumber}</td>
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{j.sourceModule ?? '—'}</td>
                  <td className="px-3 py-2">{j.narration}</td>
                  <td className="px-3 py-2 text-right tabular"><Pkr value={Number(j.totalDebitPkr ?? 0)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {lines.length > 0 && (
        <>
          <SectionDivider label={`Lines for ${journals[0]!.journalNumber}`} />
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                  <tr>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Account</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Debit</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 tabular text-xs">{l.accountCode} {l.accountName}</td>
                      <td className="px-3 py-2 text-right tabular"><Pkr value={Number(l.debitPkr ?? 0)} /></td>
                      <td className="px-3 py-2 text-right tabular"><Pkr value={Number(l.creditPkr ?? 0)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <SectionDivider label="Approvals in period" />
      <Card>
        <CardHeader><CardTitle>{approvals.length} approvals</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Type</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">State</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Title</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Amount</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Created</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{a.approvalType}</td>
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{a.state}</td>
                  <td className="px-3 py-2">{a.title}</td>
                  <td className="px-3 py-2 text-right tabular"><Pkr value={Number(a.amountPkr ?? 0)} /></td>
                  <td className="px-3 py-2 tabular text-xs">{isoDate(new Date(a.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionDivider label="Cost allocations" />
      <Card>
        <CardHeader><CardTitle>{allocs.length} allocations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pool</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Source</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Amount</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Allocated</th>
              </tr>
            </thead>
            <tbody>
              {allocs.map((a) => (
                <tr key={a.id} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{a.costPool}</td>
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{a.sourceModule}</td>
                  <td className="px-3 py-2 text-right tabular"><Pkr value={Number(a.amountPkr ?? 0)} /></td>
                  <td className="px-3 py-2 tabular text-xs">{a.allocatedOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--fg-muted)] mt-4">
        Auditor view: SELECT-only at the database level. Approval action history is included in the XLSX export.
      </p>
    </div>
  );
}
