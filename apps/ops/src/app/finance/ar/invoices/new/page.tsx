import { and, eq } from 'drizzle-orm';
import { db, buyersCrm, forwardContracts, mandiDispatches } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { createArInvoice } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewArInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ dispatchId?: string; contractId?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;

  const buyers = entityId
    ? await db.select().from(buyersCrm).where(eq(buyersCrm.entityId, entityId)).limit(500)
    : [];

  const presetDispatch = sp.dispatchId
    ? (await db.select().from(mandiDispatches).where(and(eq(mandiDispatches.id, sp.dispatchId), eq(mandiDispatches.entityId, entityId))).limit(1))[0]
    : null;
  const presetContract = sp.contractId
    ? (await db.select().from(forwardContracts).where(and(eq(forwardContracts.id, sp.contractId), eq(forwardContracts.entityId, entityId))).limit(1))[0]
    : null;

  const today = new Date().toISOString().slice(0, 10);
  const due30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section="New AR invoice" />
      <Card>
        <CardHeader><CardTitle className="text-base">Invoice details</CardTitle></CardHeader>
        <CardContent>
          <form action={createArInvoice} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Buyer</span>
              <select name="buyerId" required defaultValue={presetContract?.buyerId ?? ''} className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1">
                <option value="">Select buyer</option>
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Invoice number</span>
              <input name="invoiceNumber" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Invoice date</span>
              <input type="date" name="invoiceDate" defaultValue={today} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Due date</span>
              <input type="date" name="dueDate" defaultValue={due30} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Amount (PKR)</span>
              <input
                type="number" step="0.01" name="amountPkr"
                defaultValue={presetDispatch?.netWeightKg ? Number(presetDispatch.netWeightKg).toFixed(2) : presetContract ? Number(presetContract.deliveredPkr).toFixed(2) : ''}
                required
                className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Tax (PKR)</span>
              <input type="number" step="0.01" name="taxPkr" defaultValue="0" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Discount (PKR)</span>
              <input type="number" step="0.01" name="discountPkr" defaultValue="0" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Payment terms (days)</span>
              <input type="number" step="1" name="paymentTermsDays" defaultValue="30" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <input type="hidden" name="salesDispatchId" defaultValue={sp.dispatchId ?? ''} />
            <input type="hidden" name="forwardContractId" defaultValue={sp.contractId ?? ''} />
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="smallcaps text-xs">Description</span>
              <textarea name="description" rows={3} className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="smallcaps text-xs">Invoice PDF URL</span>
              <input name="invoicePdfUrl" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <div className="md:col-span-2">
              <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-4 py-2 text-sm text-[var(--paper)]">
                Create invoice
              </button>
              <p className="mt-2 text-xs text-[var(--zameen-600)]">
                Credit limit is checked before insert. Over-limit invoices are blocked.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
