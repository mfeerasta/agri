import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, ppeIssuances, workers } from '@zameen/db';
import { Masthead, SectionDivider, StatBlock, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PROTECTIVE_KINDS = new Set(['mask_n95', 'respirator', 'gloves_chemical']);

export default async function PpePage() {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: ppeIssuances.id,
      workerId: ppeIssuances.workerId,
      workerName: workers.fullName,
      workerCode: workers.code,
      ppeKind: ppeIssuances.ppeKind,
      issuedOn: ppeIssuances.issuedOn,
      quantity: ppeIssuances.quantity,
      expiresOn: ppeIssuances.expiresOn,
      costPkr: ppeIssuances.costPkr,
      acknowledgementSigned: ppeIssuances.acknowledgementSigned,
    })
    .from(ppeIssuances)
    .innerJoin(workers, eq(workers.id, ppeIssuances.workerId))
    .orderBy(desc(ppeIssuances.issuedOn))
    .limit(500);

  const expired = rows.filter((r) => r.expiresOn && r.expiresOn < today);
  const expiringSoon = rows.filter((r) => r.expiresOn && r.expiresOn >= today && r.expiresOn <= soon);
  const expiredCriticalCount = expired.filter((r) => PROTECTIVE_KINDS.has(r.ppeKind)).length;

  return (
    <div>
      <Masthead section="PPE" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">Personal protective equipment register</div>
        <Link href={'/labor/ppe/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Issue PPE</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-[var(--rule)]">
        <StatBlock label="Active issuances" value={rows.length} />
        <StatBlock label="Expired (chem-critical)" value={expiredCriticalCount} caption="masks, respirators, chem gloves" />
        <StatBlock label="Expiring within 30 days" value={expiringSoon.length} />
      </div>

      <SectionDivider label="All issuances" />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No PPE issued yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Worker</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">PPE</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Issued</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Qty</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Cost</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Ack</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isExpired = r.expiresOn && r.expiresOn < today;
                  const isSoon = r.expiresOn && r.expiresOn >= today && r.expiresOn <= soon;
                  return (
                    <tr key={r.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2"><Link href={`/labor/workers/${r.workerId}` as never} className="hover:underline">{r.workerName}</Link></td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.ppeKind}</td>
                      <td className="px-3 py-2 tabular text-xs">{fmtDate(r.issuedOn)}</td>
                      <td className="px-3 py-2 text-right tabular">{r.quantity}</td>
                      <td className={`px-3 py-2 tabular text-xs ${isExpired ? 'text-rose-700 font-semibold' : isSoon ? 'text-amber-700' : ''}`}>{fmtDate(r.expiresOn)}</td>
                      <td className="px-3 py-2 text-right">{r.costPkr ? <Pkr value={r.costPkr} /> : null}</td>
                      <td className="px-3 py-2 text-xs">{r.acknowledgementSigned ? 'signed' : 'pending'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
