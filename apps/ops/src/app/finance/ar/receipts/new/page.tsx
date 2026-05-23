import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, arInvoices } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { recordArReceipt } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewArReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;

  const openInvoices = entityId
    ? await db
        .select()
        .from(arInvoices)
        .where(and(eq(arInvoices.entityId, entityId), inArray(arInvoices.status, ['open', 'partial', 'overdue'])))
        .orderBy(desc(arInvoices.dueDate))
        .limit(200)
    : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Masthead section="Record AR receipt" />
      <Card>
        <CardHeader><CardTitle className="text-base">Payment received</CardTitle></CardHeader>
        <CardContent>
          <form action={recordArReceipt} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="smallcaps text-xs">Invoice</span>
              <select name="invoiceId" required defaultValue={sp.invoiceId ?? ''} className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1">
                <option value="">Select invoice</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} - due {i.dueDate} - outstanding {Number(i.outstandingPkr).toFixed(2)} PKR
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Received on</span>
              <input type="date" name="receivedOn" defaultValue={today} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Amount (PKR)</span>
              <input type="number" step="0.01" name="amountPkr" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Method</span>
              <select name="method" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1">
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="online">Online</option>
                <option value="adjustment">Adjustment</option>
                <option value="barter">Barter</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Reference #</span>
              <input name="referenceNumber" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Bank name</span>
              <input name="bankName" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Cleared on</span>
              <input type="date" name="clearedOn" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="smallcaps text-xs">Notes</span>
              <textarea name="notes" rows={2} className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <div className="md:col-span-2">
              <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-4 py-2 text-sm text-[var(--paper)]">
                Record receipt &amp; route for approval
              </button>
              <p className="mt-2 text-xs text-[var(--zameen-600)]">
                Posts Dr Cash/Bank, Cr Accounts Receivable. Routes through approval workflow.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
