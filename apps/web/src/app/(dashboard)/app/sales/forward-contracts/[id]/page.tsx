import { db, forwardContracts, contractDeliveries, buyersCrm } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { RecordDeliveryForm } from './delivery-form-client';

export const dynamic = 'force-dynamic';

export default async function ForwardContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c] = await db.select().from(forwardContracts).where(eq(forwardContracts.id, id));
  if (!c) notFound();
  const [buyer] = await db.select().from(buyersCrm).where(eq(buyersCrm.id, c.buyerId));
  const deliveries = await db.select().from(contractDeliveries).where(eq(contractDeliveries.contractId, id)).orderBy(desc(contractDeliveries.deliveredOn));

  const committed = Number(c.committedKg);
  const delivered = Number(c.deliveredKg);
  const remainingKg = Math.max(0, committed - delivered);
  const pct = committed > 0 ? (delivered / committed) * 100 : 0;
  const totalValue = committed * Number(c.agreedPricePerKgPkr);

  return (
    <div className="space-y-3">
      <Masthead section={`CONTRACT ${c.contractNumber}`} />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>{buyer?.name ?? 'Buyer'} · {c.cropCode}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Committed</span><div className="tabular">{committed.toLocaleString()} kg</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Delivered</span><div className="tabular">{delivered.toLocaleString()} kg ({pct.toFixed(0)}%)</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Remaining</span><div className="tabular">{remainingKg.toLocaleString()} kg</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Status</span><div className="smallcaps text-xs">{c.status}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">PKR/kg</span><div className="tabular">{Number(c.agreedPricePerKgPkr).toLocaleString()}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Total value</span><div className="tabular">{Math.round(totalValue).toLocaleString()}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Advance</span><div className="tabular">{Number(c.advanceReceivedPkr).toLocaleString()}</div></div>
          <div><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Window</span><div>{c.deliveryWindowStart} → {c.deliveryWindowEnd}</div></div>
          <div className="col-span-2 md:col-span-4"><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Delivery point</span><div>{c.deliveryPoint ?? '—'}</div></div>
          <div className="col-span-2 md:col-span-4"><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Payment terms</span><div>{c.paymentTerms ?? '—'}</div></div>
          {c.penaltyClause ? <div className="col-span-2 md:col-span-4"><span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Penalty clause</span><div>{c.penaltyClause}</div></div> : null}
        </CardContent>
      </Card>

      {c.status !== 'fulfilled' && c.status !== 'cancelled' ? (
        <Card>
          <CardHeader><CardTitle>Record delivery</CardTitle></CardHeader>
          <CardContent>
            <RecordDeliveryForm contractId={c.id} remainingKg={remainingKg} pricePerKg={Number(c.agreedPricePerKgPkr)} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Delivery ledger ({deliveries.length})</CardTitle></CardHeader>
        <CardContent>
          {deliveries.length === 0 ? <div className="text-sm text-[var(--ink)]/50">No deliveries yet.</div> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[var(--rule)]">
                <th className="text-left py-1">Date</th>
                <th className="text-right">Kg</th>
                <th className="text-right">PKR</th>
                <th className="text-left">Lots</th>
                <th className="text-left">Note</th>
              </tr></thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t border-[var(--rule)]">
                    <td className="py-1">{d.deliveredOn}</td>
                    <td className="text-right tabular">{Number(d.kg).toLocaleString()}</td>
                    <td className="text-right tabular">{Number(d.pkr).toLocaleString()}</td>
                    <td className="font-mono text-[0.65rem]">{(d.produceLotIds ?? []).length}</td>
                    <td>{d.notes ?? '—'}</td>
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
