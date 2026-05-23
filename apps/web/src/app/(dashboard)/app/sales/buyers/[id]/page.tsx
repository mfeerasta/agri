import { db, buyersCrm, salesOpportunities, forwardContracts } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [buyer] = await db.select().from(buyersCrm).where(eq(buyersCrm.id, id));
  if (!buyer) notFound();

  const [opps, contracts] = await Promise.all([
    db.select().from(salesOpportunities).where(eq(salesOpportunities.buyerId, id)).orderBy(desc(salesOpportunities.createdAt)),
    db.select().from(forwardContracts).where(eq(forwardContracts.buyerId, id)).orderBy(desc(forwardContracts.signedOn)),
  ]);

  const totalCommittedKg = contracts.reduce((a, c) => a + Number(c.committedKg), 0);
  const totalDeliveredKg = contracts.reduce((a, c) => a + Number(c.deliveredKg), 0);

  return (
    <div className="space-y-3">
      <Masthead section={buyer.name.toUpperCase()} />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Buyer detail</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Type</span><div>{buyer.buyerType}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Status</span><div>{buyer.status}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Phone</span><div>{buyer.phone ?? '—'}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Email</span><div>{buyer.email ?? '—'}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Contact</span><div>{buyer.contactPerson ?? '—'}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Payment terms</span><div>{buyer.paymentTermsDays ?? '—'} days</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Credit limit</span><div>PKR {buyer.creditLimitPkr ?? '0'}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">CNIC / NTN</span><div>{buyer.cnic ?? '—'} / {buyer.ntn ?? '—'}</div></div>
          <div className="col-span-2"><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Address</span><div>{buyer.address ?? '—'}</div></div>
          {buyer.notes ? <div className="col-span-2"><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Notes</span><div>{buyer.notes}</div></div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Forward contracts ({contracts.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="text-xs mb-2 tabular">
            Committed: {totalCommittedKg.toLocaleString()} kg · Delivered: {totalDeliveredKg.toLocaleString()} kg
          </div>
          {contracts.length === 0 ? <div className="text-sm text-[var(--ink)]/50">No contracts.</div> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[var(--rule)]">
                <th className="text-left py-1">#</th><th className="text-left">Crop</th>
                <th className="text-right">Kg</th><th className="text-right">PKR/kg</th>
                <th className="text-left">Window</th><th className="text-left">Status</th>
              </tr></thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--rule)]">
                    <td className="py-1"><a className="underline" href={`/app/sales/forward-contracts/${c.id}`}>{c.contractNumber}</a></td>
                    <td>{c.cropCode}</td>
                    <td className="text-right tabular">{Number(c.committedKg).toLocaleString()}</td>
                    <td className="text-right tabular">{Number(c.agreedPricePerKgPkr).toLocaleString()}</td>
                    <td>{c.deliveryWindowStart} → {c.deliveryWindowEnd}</td>
                    <td className="smallcaps text-[0.65rem]">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Opportunities ({opps.length})</CardTitle></CardHeader>
        <CardContent>
          {opps.length === 0 ? <div className="text-sm text-[var(--ink)]/50">No opportunities.</div> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[var(--rule)]">
                <th className="text-left py-1">Crop</th><th className="text-right">Kg</th>
                <th className="text-right">Target PKR/kg</th><th className="text-left">Stage</th>
                <th className="text-right">Win %</th><th className="text-left">Close by</th>
              </tr></thead>
              <tbody>
                {opps.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--rule)]">
                    <td className="py-1">{o.cropCode}</td>
                    <td className="text-right tabular">{Number(o.estimatedKg).toLocaleString()}</td>
                    <td className="text-right tabular">{o.targetPricePerKgPkr ?? '—'}</td>
                    <td className="smallcaps text-[0.65rem]">{o.stage}</td>
                    <td className="text-right tabular">{o.winProbabilityPct ?? '—'}</td>
                    <td>{o.expectedCloseDate ?? '—'}</td>
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
