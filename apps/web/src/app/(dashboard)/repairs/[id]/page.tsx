import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, desc } from 'drizzle-orm';
import { db, repairRequests, repairQuotes, repairWorkOrders, partsReplaced, approvalRequests, approvalActions } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, ApprovalBanner, QuoteComparison, Pkr } from '@zameen/ui';
import { fmtDate, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function RepairDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [req] = await db.select().from(repairRequests).where(eq(repairRequests.id, id)).limit(1);
  if (!req) notFound();
  const quotes = await db.select().from(repairQuotes).where(eq(repairQuotes.repairRequestId, id));
  const [wo] = await db.select().from(repairWorkOrders).where(eq(repairWorkOrders.repairRequestId, id)).limit(1);
  const parts = wo ? await db.select().from(partsReplaced).where(eq(partsReplaced.workOrderId, wo.id)) : [];
  const approval = req.approvalRequestId
    ? (await db.select().from(approvalRequests).where(eq(approvalRequests.id, req.approvalRequestId)).limit(1))[0]
    : null;
  const actions = approval
    ? await db.select().from(approvalActions).where(eq(approvalActions.approvalRequestId, approval.id)).orderBy(desc(approvalActions.occurredAt))
    : [];

  return (
    <div>
      <Masthead section="REPAIR REQUEST" />
      <SectionDivider />
      <Card className="mb-6">
        <CardHeader className="flex justify-between items-baseline">
          <CardTitle>{req.requestNumber}</CardTitle>
          <span className="smallcaps text-[0.7rem] text-[var(--ink)]/60">{req.severity}</span>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-body">{req.issueDescription}</p>
          {req.issueDescriptionUr ? <p className="urdu text-right">{req.issueDescriptionUr}</p> : null}
          <div className="text-xs text-[var(--ink)]/60 tabular">Reported {fmtDateTime(req.reportedAt)} · status {req.status}</div>
          {req.problemPhotoUrls.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {req.problemPhotoUrls.map((u, i) => (
                <img key={u} src={u} alt={`problem ${i + 1}`} className="aspect-square object-cover border border-[var(--rule)]" />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <SectionDivider label="Quotes" />
      <div className="mb-3 flex justify-end">
        <Link href={`/repairs/${id}/quotes/new` as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Add quote</Link>
      </div>
      <QuoteComparison
        quotes={quotes.map((q) => ({
          id: q.id,
          workshopName: q.workshopName,
          totalPkr: Number(q.totalQuotePkr),
          etaDays: q.etaDays ? Number(q.etaDays) : null,
          warrantyDays: q.warrantyDays ? Number(q.warrantyDays) : null,
        }))}
        selectedId={req.selectedQuoteId ?? undefined}
        readOnly
      />

      {approval ? (
        <>
          <SectionDivider label="Approval" />
          <Card>
            <CardContent>
              <ApprovalBanner state={approval.state as never} amountPkr={approval.amountPkr ?? undefined} />
              <ul className="mt-3 space-y-1 text-xs">
                {actions.map((a) => (
                  <li key={a.id} className="border-l-2 border-[var(--rule)] pl-2">
                    <span className="smallcaps mr-2">{a.action}</span>
                    <span className="tabular">{fmtDateTime(a.occurredAt)}</span>
                    {a.comment ? <span className="ml-2 text-[var(--ink)]/60">— {a.comment}</span> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}

      {wo ? (
        <>
          <SectionDivider label="Work order" />
          <Card>
            <CardHeader><CardTitle>{wo.woNumber}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="smallcaps text-[0.7rem] block">Issued</span><span className="tabular">{fmtDateTime(wo.issuedAt)}</span></div>
                <div><span className="smallcaps text-[0.7rem] block">Completed</span><span className="tabular">{fmtDateTime(wo.actualCompletionAt)}</span></div>
                <div><span className="smallcaps text-[0.7rem] block">Invoice</span>{wo.finalInvoicePkr ? <Pkr value={wo.finalInvoicePkr} /> : '—'}</div>
                <div><span className="smallcaps text-[0.7rem] block">Warranty</span><span className="tabular">{fmtDate(wo.warrantyEnd)}</span></div>
              </div>
              {!wo.actualCompletionAt ? (
                <Link href={`/repairs/${id}/work-order/close` as never} className="inline-block border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">Close work order</Link>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {parts.length > 0 ? (
        <>
          <SectionDivider label="Parts replaced" />
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Part</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Qty</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Total</th>
                </tr></thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2">{p.partName}</td>
                      <td className="px-3 py-2 text-right tabular">{p.quantity}</td>
                      <td className="px-3 py-2 text-right"><Pkr value={p.totalCostPkr} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
