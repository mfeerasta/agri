import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import {
  db,
  rfqs,
  rfqLineItems,
  rfqInvitations,
  rfqQuotes,
  vendors,
  approvalRequests,
  purchaseOrders,
} from '@zameen/db';
import {
  Masthead,
  SectionDivider,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ApprovalBanner,
  Pkr,
} from '@zameen/ui';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { RfqWinnerPicker } from './rfq-winner-picker';
import { RfqSendInvitationsButton } from './rfq-send-button';

export const dynamic = 'force-dynamic';

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
  if (!rfq) notFound();

  const [lineItems, invitations, quotes] = await Promise.all([
    db.select().from(rfqLineItems).where(eq(rfqLineItems.rfqId, id)),
    db.select().from(rfqInvitations).where(eq(rfqInvitations.rfqId, id)),
    db.select().from(rfqQuotes).where(eq(rfqQuotes.rfqId, id)),
  ]);

  const vendorIds = Array.from(
    new Set([...invitations.map((i) => i.vendorId), ...quotes.map((q) => q.vendorId)]),
  );
  const vendorRows = vendorIds.length
    ? await db.select().from(vendors).where(inArray(vendors.id, vendorIds))
    : [];
  const vendorById = new Map(vendorRows.map((v) => [v.id, v]));

  const approval = rfq.approvalRequestId
    ? (await db.select().from(approvalRequests).where(eq(approvalRequests.id, rfq.approvalRequestId)).limit(1))[0]
    : null;
  const po = rfq.purchaseOrderId
    ? (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, rfq.purchaseOrderId)).limit(1))[0]
    : null;

  const cheapest = quotes.reduce(
    (m, q) => (Number(q.totalPkr) < m ? Number(q.totalPkr) : m),
    Infinity,
  );

  const editable = rfq.status === 'draft' || rfq.status === 'sent' || rfq.status === 'quotes_received';

  return (
    <div>
      <Masthead section={`RFQ · ${rfq.rfqNumber}`} />
      <SectionDivider />
      <Card className="mb-4">
        <CardHeader className="flex justify-between items-baseline">
          <CardTitle>{rfq.title}</CardTitle>
          <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">
            {rfq.status.replace(/_/g, ' ')}
          </span>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rfq.description ? <p>{rfq.description}</p> : null}
          <div className="grid gap-2 md:grid-cols-4 text-xs">
            <div>
              <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Category · </span>
              {rfq.category}
            </div>
            <div>
              <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Needed by · </span>
              {rfq.neededBy ? fmtDate(rfq.neededBy) : '—'}
            </div>
            <div>
              <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Budget · </span>
              {rfq.budgetEstimatePkr
                ? `${Number(rfq.budgetEstimatePkr).toLocaleString('en-PK')} PKR`
                : '—'}
            </div>
            <div>
              <span className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Created · </span>
              {fmtDateTime(rfq.createdAt)}
            </div>
          </div>
        </CardContent>
      </Card>

      {approval ? (
        <div className="mb-4">
          <ApprovalBanner
            state={approval.state as never}
            amountPkr={Number(approval.amountPkr ?? 0)}
          />
        </div>
      ) : null}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Description</th>
                <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Qty</th>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Unit</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.id} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2">{li.description}</td>
                  <td className="px-3 py-2 text-right tabular">{Number(li.quantity)}</td>
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{li.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="flex justify-between items-baseline">
          <CardTitle>Invitations ({invitations.length})</CardTitle>
          {editable && invitations.some((i) => !i.sentAt) ? (
            <RfqSendInvitationsButton rfqId={rfq.id} />
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Vendor</th>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Sent</th>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Responded</th>
                <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Status</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const v = vendorById.get(inv.vendorId);
                const status = inv.declinedReason
                  ? 'declined'
                  : inv.respondedAt
                    ? 'quoted'
                    : inv.sentAt
                      ? 'sent'
                      : 'pending';
                return (
                  <tr key={inv.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">
                      <Link href={`/procurement/vendors/${inv.vendorId}` as never} className="underline">
                        {v?.name ?? inv.vendorId}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular text-xs">
                      {inv.sentAt ? fmtDateTime(inv.sentAt) : '—'}
                    </td>
                    <td className="px-3 py-2 tabular text-xs">
                      {inv.respondedAt ? fmtDateTime(inv.respondedAt) : '—'}
                    </td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Quotes ({quotes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No quotes received yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Vendor</th>
                  <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Total</th>
                  <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Δ vs min</th>
                  <th className="text-right px-3 py-2 smallcaps text-[0.65rem]">Lead</th>
                  <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Terms</th>
                  <th className="text-left px-3 py-2 smallcaps text-[0.65rem]">Winner</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const total = Number(q.totalPkr);
                  const delta = total - cheapest;
                  return (
                    <tr
                      key={q.id}
                      className={`border-t border-[var(--rule)] ${q.isWinner ? 'bg-[var(--paper-2)]' : ''} ${total === cheapest ? 'underline decoration-[var(--ochre)] decoration-2 underline-offset-4' : ''}`}
                    >
                      <td className="px-3 py-2">{vendorById.get(q.vendorId)?.name ?? q.vendorId}</td>
                      <td className="px-3 py-2 text-right">
                        <Pkr value={total} />
                      </td>
                      <td className="px-3 py-2 text-right tabular text-xs text-[var(--ink)]/70">
                        {delta === 0 ? '—' : `+${delta.toLocaleString('en-PK')}`}
                      </td>
                      <td className="px-3 py-2 text-right tabular text-xs">
                        {q.deliveryLeadDays != null ? `${q.deliveryLeadDays}d` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">{q.paymentTerms ?? '—'}</td>
                      <td className="px-3 py-2 smallcaps text-[0.65rem]">
                        {q.isWinner ? 'selected' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {quotes.length > 0 && rfq.status !== 'selected' && rfq.status !== 'closed' && rfq.status !== 'cancelled' ? (
        <RfqWinnerPicker
          rfqId={rfq.id}
          quotes={quotes.map((q) => ({
            id: q.id,
            vendorName: vendorById.get(q.vendorId)?.name ?? q.vendorId,
            totalPkr: Number(q.totalPkr),
          }))}
        />
      ) : null}

      {rfq.selectionReason ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Selection rationale</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{rfq.selectionReason}</CardContent>
        </Card>
      ) : null}

      {po ? (
        <Card>
          <CardHeader>
            <CardTitle>Purchase order</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/procurement/purchase-orders/${po.id}` as never}
              className="underline font-mono"
            >
              {po.poNumber}
            </Link>{' '}
            · <Pkr value={Number(po.totalPkr)} /> · status {po.status}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
