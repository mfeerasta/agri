import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  db,
  auditLog,
  approvalRequests,
  approvalActions,
  journalEntries,
  journalLines,
  users,
  dieselPurchases,
  dieselDailyLogs,
  repairRequests,
  repairQuotes,
  repairWorkOrders,
} from '@zameen/db';
import {
  Masthead,
  SectionDivider,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ApprovalBanner,
  AgingBars,
  StatBlock,
  Pkr,
  JsonDiff,
  type JsonValue,
} from '@zameen/ui';
import type { ApprovalContextSnapshot } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';
import { fmtDateTime, fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Resources we know how to walk back to source records.
const KNOWN_RESOURCES = new Set([
  'journal_entry',
  'approval_request',
  'diesel_purchase',
  'diesel_daily_log',
  'repair_request',
  'repair_work_order',
  'cost_allocation',
  'crop_plan',
  'harvest_record',
]);

export default async function AuditWalkPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  const session = await getSessionContext();
  if (!session) notFound();

  if (!KNOWN_RESOURCES.has(resource)) {
    return (
      <div>
        <Masthead section="AUDIT WALK" />
        <SectionDivider />
        <p className="text-sm text-[var(--ink)]/60">
          Resource type {resource} is not walkable yet.
        </p>
      </div>
    );
  }

  // Step 1: current audit entries for this resource id.
  const auditRows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resource: auditLog.resource,
      occurredAt: auditLog.occurredAt,
      actorRole: auditLog.actorRole,
      before: auditLog.before,
      after: auditLog.after,
      actorName: users.fullName,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(and(eq(auditLog.resource, resource), eq(auditLog.resourceId, id)))
    .orderBy(desc(auditLog.occurredAt));

  // Step 2: resolve the approval request (depends on resource kind).
  let approvalReqId: string | null = null;
  let sourceModule: string | null = null;
  let sourceRecordId: string | null = null;
  let journalRow: typeof journalEntries.$inferSelect | null = null;
  let journalLinesRows: Array<typeof journalLines.$inferSelect> = [];

  if (resource === 'journal_entry') {
    const [j] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)).limit(1);
    if (j) {
      journalRow = j;
      approvalReqId = j.approvalRequestId ?? null;
      sourceModule = j.sourceModule;
      sourceRecordId = j.sourceRecordId;
      journalLinesRows = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, j.id));
    }
  } else if (resource === 'approval_request') {
    approvalReqId = id;
  } else if (resource === 'diesel_purchase') {
    const [dp] = await db.select().from(dieselPurchases).where(eq(dieselPurchases.id, id)).limit(1);
    if (dp) approvalReqId = dp.approvalRequestId ?? null;
  } else if (resource === 'repair_request') {
    const [rr] = await db.select().from(repairRequests).where(eq(repairRequests.id, id)).limit(1);
    if (rr) approvalReqId = rr.approvalRequestId ?? null;
  }

  // Step 3: load the approval + actions + photos.
  const [req] = approvalReqId
    ? await db.select().from(approvalRequests).where(eq(approvalRequests.id, approvalReqId)).limit(1)
    : [];
  const actions = approvalReqId
    ? await db
        .select({
          id: approvalActions.id,
          action: approvalActions.action,
          actorRole: approvalActions.actorRole,
          comment: approvalActions.comment,
          occurredAt: approvalActions.occurredAt,
          actorName: users.fullName,
        })
        .from(approvalActions)
        .leftJoin(users, eq(approvalActions.actorId, users.id))
        .where(eq(approvalActions.approvalRequestId, approvalReqId))
        .orderBy(asc(approvalActions.occurredAt))
    : [];

  const ctx = (req?.contextSnapshot ?? {}) as ApprovalContextSnapshot;
  const cash = ctx.cashPosition;
  const inventory = ctx.inventory;
  const quoteComparison = ctx.quoteComparison;

  const payloadAny = (req?.payload ?? {}) as Record<string, unknown>;
  const photoUrls = collectPhotoUrls(payloadAny);

  // Step 4: walk back to the source record.
  let sourceCard: React.ReactNode = null;
  let sourcePhotos: string[] = [];
  if (req?.sourceModule && req?.sourceRecordId) {
    const walked = await loadSourceRecord(req.sourceModule, req.sourceRecordId);
    sourceCard = walked.card;
    sourcePhotos = walked.photos;
  } else if (sourceModule && sourceRecordId) {
    const walked = await loadSourceRecord(sourceModule, sourceRecordId);
    sourceCard = walked.card;
    sourcePhotos = walked.photos;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Masthead section="AUDIT WALK" />
        <Link href="/audit" className="smallcaps text-xs text-[var(--ochre)] hover:underline">
          ← all events
        </Link>
      </div>
      <SectionDivider />

      <Card>
        <CardHeader>
          <CardTitle>
            {resource} / {id.slice(0, 8)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {auditRows.length === 0 ? (
            <div className="text-[var(--ink)]/60">No audit_log rows for this resource id.</div>
          ) : (
            auditRows.map((row) => (
              <div key={row.id} className="border-l-2 border-[var(--rule)] pl-3">
                <div className="flex justify-between items-baseline">
                  <span className="smallcaps text-[0.7rem]">{row.action}</span>
                  <span className="tabular text-xs text-[var(--ink)]/60">{fmtDateTime(row.occurredAt)}</span>
                </div>
                <div className="text-xs text-[var(--ink)]/70 mb-2">
                  by {row.actorName ?? row.actorRole ?? 'unknown'}
                </div>
                <JsonDiff before={row.before as JsonValue | null} after={row.after as JsonValue | null} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {journalRow ? (
        <>
          <SectionDivider label="Journal entry" />
          <Card>
            <CardHeader>
              <CardTitle>
                {journalRow.journalNumber} · {fmtDate(journalRow.postedOn)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>{journalRow.narration}</div>
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                  <tr>
                    <th className="smallcaps text-left px-2 py-1 text-[0.7rem]">Account</th>
                    <th className="smallcaps text-left px-2 py-1 text-[0.7rem]">Field</th>
                    <th className="smallcaps text-left px-2 py-1 text-[0.7rem]">Cost pool</th>
                    <th className="smallcaps text-right px-2 py-1 text-[0.7rem]">Debit</th>
                    <th className="smallcaps text-right px-2 py-1 text-[0.7rem]">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journalLinesRows.map((l) => (
                    <tr key={l.id} className="border-t border-[var(--rule)]">
                      <td className="px-2 py-1 font-mono text-xs">{l.accountId.slice(0, 8)}</td>
                      <td className="px-2 py-1 font-mono text-xs">{l.fieldId ? l.fieldId.slice(0, 8) : '—'}</td>
                      <td className="px-2 py-1 smallcaps text-[0.7rem]">{l.costPool ?? '—'}</td>
                      <td className="px-2 py-1 text-right"><Pkr value={l.debitPkr} /></td>
                      <td className="px-2 py-1 text-right"><Pkr value={l.creditPkr} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}

      {req ? (
        <>
          <SectionDivider label="Approval request" />
          <Card>
            <CardHeader>
              <CardTitle>{req.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <ApprovalBanner state={req.state as never} amountPkr={req.amountPkr ?? undefined} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBlock label="Type" value={req.approvalType} />
                <StatBlock label="Source" value={`${req.sourceModule}${req.sourceRecordId ? ` / ${req.sourceRecordId.slice(0, 8)}` : ''}`} />
                <StatBlock label="Submitted" value={req.submittedAt ? fmtDateTime(req.submittedAt) : '—'} />
                <StatBlock label="Decided" value={req.decidedAt ? fmtDateTime(req.decidedAt) : '—'} />
              </div>
            </CardContent>
          </Card>

          <SectionDivider label="Decision chain" />
          <Card>
            <CardContent className="p-4">
              <ul className="space-y-2 text-sm">
                {actions.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 border-b border-[var(--rule)] last:border-0 pb-2 last:pb-0">
                    <div>
                      <div className="smallcaps text-[0.7rem] text-[var(--ochre)]">{a.action}</div>
                      <div>{a.actorName ?? a.actorRole}</div>
                      {a.comment ? <div className="text-xs text-[var(--ink)]/70">{a.comment}</div> : null}
                    </div>
                    <div className="tabular text-xs text-[var(--ink)]/60">{fmtDateTime(a.occurredAt)}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {cash ? (
            <>
              <SectionDivider label="Cash snapshot at decision time" />
              <Card>
                <CardContent className="space-y-3 p-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <StatBlock label="Cash on hand" value={<Pkr value={cash.cashOnHandPkr} mode="lac_crore" />} />
                    {Object.entries(cash.bankBalancesPkr).map(([k, v]) => (
                      <StatBlock key={k} label={k} value={<Pkr value={v} mode="lac_crore" />} />
                    ))}
                  </div>
                  <div>
                    <div className="smallcaps text-[0.65rem] mb-2 text-[var(--ink)]/70">Payable aging</div>
                    <AgingBars buckets={cash.payableAgingPkr} />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {inventory ? (
            <Card>
              <CardHeader><CardTitle>Inventory snapshot</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-sm">
                <StatBlock label="On hand" value={inventory.onHandQty ?? '0'} />
                <StatBlock label="Reorder point" value={inventory.reorderPoint ?? 'n/a'} />
                <StatBlock label="Days of cover" value={inventory.daysOfCover ?? 'n/a'} />
              </CardContent>
            </Card>
          ) : null}

          {quoteComparison ? (
            <Card>
              <CardHeader><CardTitle>Quote comparison</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--ink)]/60">
                      <th className="py-1">Workshop</th>
                      <th className="py-1 text-right">Total</th>
                      <th className="py-1 text-right">ETA</th>
                      <th className="py-1 text-right">Warranty</th>
                      <th className="py-1">Selected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteComparison.quotes.map((q) => (
                      <tr key={q.quoteId} className={q.selected ? 'bg-[var(--success)]/10 font-medium' : ''}>
                        <td className="py-1">{q.workshopName}</td>
                        <td className="py-1 text-right tabular"><Pkr value={q.totalPkr} /></td>
                        <td className="py-1 text-right tabular">{q.etaDays ?? 'n/a'}</td>
                        <td className="py-1 text-right tabular">{q.warrantyDays ?? 'n/a'}</td>
                        <td className="py-1">{q.selected ? 'yes' : 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {photoUrls.length > 0 || sourcePhotos.length > 0 ? (
        <>
          <SectionDivider label="Photo evidence" />
          <Card>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...photoUrls, ...sourcePhotos].map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="evidence" className="w-full h-32 object-cover rounded border border-[var(--border)]" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {sourceCard ? (
        <>
          <SectionDivider label="Source record" />
          {sourceCard}
        </>
      ) : null}
    </div>
  );
}

function collectPhotoUrls(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(payload)) {
    if (Array.isArray(v)) {
      for (const item of v) if (typeof item === 'string' && /^https?:\/\//.test(item)) out.push(item);
    }
  }
  return out;
}

async function loadSourceRecord(
  module: string,
  recordId: string,
): Promise<{ card: React.ReactNode | null; photos: string[] }> {
  if (module === 'diesel_purchases' || module === 'diesel_purchase') {
    const [row] = await db.select().from(dieselPurchases).where(eq(dieselPurchases.id, recordId)).limit(1);
    if (!row) return { card: null, photos: [] };
    return {
      card: (
        <Card>
          <CardHeader><CardTitle>Diesel purchase · {row.vendorName}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>Date: {fmtDateTime(row.purchasedAt)}</div>
            <div>Litres: {String(row.quantityLiters)}, rate Rs. {String(row.rateLiterPkr)}</div>
            <div>Total: <Pkr value={row.totalPkr} /></div>
            <div className="text-xs text-[var(--ink)]/60">{row.notes ?? ''}</div>
          </CardContent>
        </Card>
      ),
      photos: row.receiptPhotoUrls ?? [],
    };
  }

  if (module === 'diesel_daily_logs' || module === 'diesel_daily_log') {
    const [row] = await db.select().from(dieselDailyLogs).where(eq(dieselDailyLogs.id, recordId)).limit(1);
    if (!row) return { card: null, photos: [] };
    return {
      card: (
        <Card>
          <CardHeader><CardTitle>Diesel daily log · {fmtDate(row.logDate)}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>Hours run: {String(row.hoursRun)}, litres: {String(row.dieselFilledLiters)}</div>
            <div>Total cost: <Pkr value={row.totalCostPkr} /></div>
            <div className="text-xs text-[var(--ink)]/60">{row.taskNotes ?? ''}</div>
          </CardContent>
        </Card>
      ),
      photos: row.receiptPhotoUrls ?? [],
    };
  }

  if (module === 'repair_requests' || module === 'repair_request') {
    const [row] = await db.select().from(repairRequests).where(eq(repairRequests.id, recordId)).limit(1);
    if (!row) return { card: null, photos: [] };
    const quotes = await db.select().from(repairQuotes).where(eq(repairQuotes.repairRequestId, row.id));
    const [wo] = await db.select().from(repairWorkOrders).where(eq(repairWorkOrders.repairRequestId, row.id)).limit(1);
    const woPhotos = wo?.finalInvoicePhotoUrls ?? [];
    return {
      card: (
        <Card>
          <CardHeader><CardTitle>Repair request · {row.requestNumber}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>{row.issueDescription}</div>
            <div className="text-xs text-[var(--ink)]/60">Severity: {row.severity}, status: {row.status}</div>
            {quotes.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                  <tr>
                    <th className="smallcaps text-left px-2 py-1 text-[0.7rem]">Workshop</th>
                    <th className="smallcaps text-right px-2 py-1 text-[0.7rem]">Total</th>
                    <th className="smallcaps text-left px-2 py-1 text-[0.7rem]">Selected</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id} className="border-t border-[var(--rule)]">
                      <td className="px-2 py-1">{q.workshopName}</td>
                      <td className="px-2 py-1 text-right"><Pkr value={q.totalQuotePkr} /></td>
                      <td className="px-2 py-1">{q.selected ? 'yes' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {wo ? <div>Final invoice: <Pkr value={wo.finalInvoicePkr ?? '0'} /></div> : null}
          </CardContent>
        </Card>
      ),
      photos: [...(row.problemPhotoUrls ?? []), ...woPhotos],
    };
  }

  return { card: null, photos: [] };
}
