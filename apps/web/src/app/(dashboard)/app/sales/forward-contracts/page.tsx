import Link from 'next/link';
import { db, forwardContracts, buyersCrm } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ForwardContractsPage() {
  const rows = await db
    .select({
      id: forwardContracts.id,
      contractNumber: forwardContracts.contractNumber,
      cropCode: forwardContracts.cropCode,
      committedKg: forwardContracts.committedKg,
      deliveredKg: forwardContracts.deliveredKg,
      agreedPricePerKgPkr: forwardContracts.agreedPricePerKgPkr,
      deliveryWindowEnd: forwardContracts.deliveryWindowEnd,
      status: forwardContracts.status,
      buyerName: buyersCrm.name,
    })
    .from(forwardContracts)
    .leftJoin(buyersCrm, eq(forwardContracts.buyerId, buyersCrm.id))
    .orderBy(desc(forwardContracts.signedOn));

  const today = new Date();

  return (
    <div>
      <Masthead section="FORWARD CONTRACTS" />
      <SectionDivider />
      <div className="mb-3 flex justify-end">
        <Link href="/app/sales/forward-contracts/new" className="rounded bg-[var(--ink)] text-[var(--paper)] px-3 py-1.5 text-xs smallcaps">+ New contract</Link>
      </div>
      <Card>
        <CardHeader><CardTitle>{rows.length} contracts</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No forward contracts yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="text-left px-3 py-2 smallcaps">#</th>
                <th className="text-left px-3 py-2 smallcaps">Buyer</th>
                <th className="text-left px-3 py-2 smallcaps">Crop</th>
                <th className="text-right px-3 py-2 smallcaps">Committed</th>
                <th className="text-right px-3 py-2 smallcaps">Delivered</th>
                <th className="text-left px-3 py-2 smallcaps">Progress</th>
                <th className="text-right px-3 py-2 smallcaps">Days left</th>
                <th className="text-left px-3 py-2 smallcaps">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((c) => {
                  const committed = Number(c.committedKg);
                  const delivered = Number(c.deliveredKg);
                  const pct = committed > 0 ? Math.min(100, (delivered / committed) * 100) : 0;
                  const end = new Date(c.deliveryWindowEnd);
                  const daysLeft = daysBetween(today, end);
                  const ratio = committed > 0 ? delivered / committed : 0;
                  let flag: 'green' | 'amber' | 'red' | 'gray' = 'gray';
                  if (c.status === 'fulfilled') flag = 'green';
                  else if (c.status === 'breached') flag = 'red';
                  else if (daysLeft < 0 && ratio < 1) flag = 'red';
                  else if (daysLeft <= 14 && ratio < 0.5) flag = 'amber';
                  const flagColor = flag === 'red' ? '#c0392b' : flag === 'amber' ? '#d4a017' : flag === 'green' ? '#2c7a3e' : '#666';
                  return (
                    <tr key={c.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 font-mono"><Link href={`/app/sales/forward-contracts/${c.id}`} className="underline">{c.contractNumber}</Link></td>
                      <td className="px-3 py-2">{c.buyerName ?? '—'}</td>
                      <td className="px-3 py-2">{c.cropCode}</td>
                      <td className="px-3 py-2 text-right tabular">{committed.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular">{delivered.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="w-24 h-2 bg-[var(--paper-2)] rounded overflow-hidden">
                          <div style={{ width: `${pct}%`, background: flagColor, height: '100%' }} />
                        </div>
                        <div className="text-[0.65rem] text-[var(--ink)]/60 tabular">{pct.toFixed(0)}%</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular" style={{ color: flag === 'red' || flag === 'amber' ? flagColor : undefined }}>
                        {daysLeft}
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.65rem]" style={{ color: flagColor }}>{c.status}</td>
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
