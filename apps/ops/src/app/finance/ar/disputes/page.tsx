import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, arDisputes, arInvoices } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { raiseArDispute, resolveArDispute } from '../actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'investigating', 'negotiating', 'resolved', 'escalated_to_legal', 'withdrawn', 'written_off'] as const;
const KINDS = ['quantity_short', 'quality_issue', 'wrong_amount', 'duplicate_billing', 'already_paid', 'contract_breach', 'other'] as const;

export default async function ArDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const sp = await searchParams;
  const status = sp.status;

  const allInv = entityId ? await db.select().from(arInvoices).where(eq(arInvoices.entityId, entityId)) : [];
  const invIds = allInv.map((i) => i.id);
  const invMap = new Map(allInv.map((i) => [i.id, i]));

  const disputes = invIds.length === 0
    ? []
    : await db
        .select()
        .from(arDisputes)
        .where(status ? and(inArray(arDisputes.invoiceId, invIds), eq(arDisputes.status, status)) : inArray(arDisputes.invoiceId, invIds))
        .orderBy(desc(arDisputes.raisedOn))
        .limit(200);

  const openInvoices = allInv.filter((i) => ['open', 'partial', 'overdue', 'disputed'].includes(i.status));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Masthead section="AR disputes" />

      <div className="flex flex-wrap gap-2">
        <a href="/finance/ar/disputes" className={`smallcaps rounded-sm px-2 py-1 text-xs ${!status ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'}`}>all</a>
        {STATUSES.map((s) => (
          <a key={s} href={`/finance/ar/disputes?status=${s}`} className={`smallcaps rounded-sm px-2 py-1 text-xs ${status === s ? 'bg-[var(--zameen-700)] text-[var(--paper)]' : 'bg-[var(--paper-2)]'}`}>{s}</a>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Raise a dispute</CardTitle></CardHeader>
        <CardContent>
          <form action={raiseArDispute} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="md:col-span-2 flex flex-col gap-1">
              <span className="smallcaps text-xs">Invoice</span>
              <select name="invoiceId" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1">
                <option value="">Select invoice</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} - outstanding {Number(i.outstandingPkr).toFixed(2)} PKR
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Raised on</span>
              <input type="date" name="raisedOn" defaultValue={today} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Raised by (buyer name)</span>
              <input name="raisedByBuyer" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Kind</span>
              <select name="disputeKind" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1">
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="smallcaps text-xs">Disputed amount (PKR)</span>
              <input type="number" step="0.01" name="disputedAmountPkr" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="md:col-span-3 flex flex-col gap-1">
              <span className="smallcaps text-xs">Description</span>
              <textarea name="description" rows={3} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <label className="md:col-span-3 flex flex-col gap-1">
              <span className="smallcaps text-xs">Evidence URLs (one per line)</span>
              <textarea name="evidenceUrls" rows={2} className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-2 py-1" />
            </label>
            <div className="md:col-span-3">
              <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-4 py-2 text-sm text-[var(--paper)]">Raise dispute</button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Disputes ({disputes.length})</CardTitle></CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <EmptyState title="No disputes" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="smallcaps text-xs text-[var(--zameen-600)]">
                  <th className="text-left">Raised</th>
                  <th className="text-left">Invoice</th>
                  <th className="text-left">Kind</th>
                  <th className="text-right">Disputed</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Resolve</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => {
                  const inv = invMap.get(d.invoiceId);
                  const canResolve = ['open', 'investigating', 'negotiating'].includes(d.status);
                  return (
                    <tr key={d.id} className="border-b border-[var(--paper-2)] align-top">
                      <td>{d.raisedOn}</td>
                      <td className="font-mono text-xs">{inv?.invoiceNumber ?? d.invoiceId.slice(0, 8)}</td>
                      <td className="smallcaps text-xs">{d.disputeKind}</td>
                      <td className="tabular text-right">{d.disputedAmountPkr ? <Pkr value={Number(d.disputedAmountPkr)} /> : '-'}</td>
                      <td className="smallcaps text-xs">{d.status}</td>
                      <td>
                        {canResolve && (
                          <form action={resolveArDispute} className="flex flex-col gap-1">
                            <input type="hidden" name="disputeId" value={d.id} />
                            <input type="date" name="resolvedOn" defaultValue={today} required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-1 py-0.5 text-xs" />
                            <select name="status" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-1 py-0.5 text-xs">
                              <option value="resolved">resolved</option>
                              <option value="escalated_to_legal">escalate legal</option>
                              <option value="withdrawn">withdrawn</option>
                              <option value="written_off">write-off</option>
                            </select>
                            <input type="number" step="0.01" name="resolutionAmountPkr" placeholder="amount" className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-1 py-0.5 text-xs" />
                            <input name="resolution" placeholder="resolution note" required className="rounded-sm border border-[var(--paper-2)] bg-[var(--paper)] px-1 py-0.5 text-xs" />
                            <button className="smallcaps rounded-sm bg-[var(--zameen-700)] px-2 py-0.5 text-[10px] text-[var(--paper)]">submit</button>
                          </form>
                        )}
                      </td>
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
