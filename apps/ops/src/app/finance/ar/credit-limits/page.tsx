import { and, eq } from 'drizzle-orm';
import { db, buyersCrm, buyerCreditLimits } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { upsertBuyerCreditLimit } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CreditLimitsPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const buyers = entityId ? await db.select().from(buyersCrm).where(eq(buyersCrm.entityId, entityId)).limit(500) : [];
  const active = entityId
    ? await db
        .select()
        .from(buyerCreditLimits)
        .where(and(eq(buyerCreditLimits.entityId, entityId), eq(buyerCreditLimits.isActive, true)))
    : [];
  const limByBuyer = new Map(active.map((l) => [l.buyerId, l]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section="Buyer credit limits" />

      <Card>
        <CardHeader><CardTitle className="text-base">Set or update a credit limit</CardTitle></CardHeader>
        <CardContent>
          <form action={upsertBuyerCreditLimit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="smallcaps text-xs">Buyer</span>
              <select name="buyerId" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1">
                <option value="">Select buyer</option>
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Credit limit (PKR)</span>
              <input type="number" step="0.01" name="creditLimitPkr" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Payment terms (days)</span>
              <input type="number" name="paymentTermsDays" defaultValue="30" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Early-pay discount %</span>
              <input type="number" step="0.01" name="earlyPaymentDiscountPct" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Late fee %/month</span>
              <input type="number" step="0.01" name="lateFeePctPerMonth" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Effective from</span>
              <input type="date" name="effectiveFrom" defaultValue={today} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Effective to</span>
              <input type="date" name="effectiveTo" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="md:col-span-3 flex flex-col gap-1">
              <span className="smallcaps text-xs">Notes</span>
              <textarea name="notes" rows={2} className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <div className="md:col-span-3">
              <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-4 py-2 text-sm text-[var(--paper)]">
                Save (routes to director approval)
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Active limits ({active.length})</CardTitle></CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <EmptyState title="No active credit limits" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="smallcaps text-xs text-[var(--zameen-600)]">
                  <th className="text-left">Buyer</th>
                  <th className="text-right">Limit</th>
                  <th className="text-right">Terms (days)</th>
                  <th className="text-right">Early-pay %</th>
                  <th className="text-right">Late fee %/mo</th>
                  <th className="text-left">From</th>
                  <th className="text-left">To</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b) => {
                  const l = limByBuyer.get(b.id);
                  if (!l) return null;
                  return (
                    <tr key={b.id} className="border-b border-[var(--paper-2)]">
                      <td>{b.name}</td>
                      <td className="tabular text-right"><Pkr value={Number(l.creditLimitPkr)} /></td>
                      <td className="tabular text-right">{l.paymentTermsDays}</td>
                      <td className="tabular text-right">{l.earlyPaymentDiscountPct ?? '-'}</td>
                      <td className="tabular text-right">{l.lateFeePctPerMonth ?? '-'}</td>
                      <td>{l.effectiveFrom}</td>
                      <td>{l.effectiveTo ?? '-'}</td>
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
