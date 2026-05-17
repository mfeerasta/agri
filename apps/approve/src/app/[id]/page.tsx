import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, approvalRequests, approvalActions } from '@zameen/db';
import {
  AgingBars,
  ApprovalBanner,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Pkr,
  StatBlock,
} from '@zameen/ui';
import type { ApprovalContextSnapshot } from '@zameen/approvals';
import { DecisionPanel } from './decision-panel';
import { ApprovalExplainer } from './approval-explainer';

function tierForAmount(thresholds: Record<string, number | null>, amount: number): string {
  const supervisor = thresholds.supervisor;
  const farmManager = thresholds.farm_manager;
  if (supervisor !== null && supervisor !== undefined && amount <= supervisor) return 'supervisor';
  if (farmManager !== null && farmManager !== undefined && amount <= farmManager) return 'farm_manager';
  return 'director';
}

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1);
  if (!req) notFound();
  const actions = await db
    .select()
    .from(approvalActions)
    .where(eq(approvalActions.approvalRequestId, id))
    .orderBy(desc(approvalActions.occurredAt));

  const ctx = (req.contextSnapshot ?? {}) as ApprovalContextSnapshot;
  const cash = ctx.cashPosition;
  const recentSimilar = ctx.recentSimilar ?? [];
  const inventory = ctx.inventory;
  const thresholds = ctx.policyThresholdsPkr;
  const requesterActivity = ctx.requesterRecentActivity ?? [];
  const quoteComparison = ctx.quoteComparison;

  const amountNum = req.amountPkr ? Number(req.amountPkr) : 0;
  const activeTier = thresholds ? tierForAmount(thresholds, amountNum) : null;

  const lowCover = inventory?.daysOfCover !== undefined && inventory.daysOfCover < 7;
  const belowReorder =
    inventory?.onHandQty !== undefined &&
    inventory?.reorderPoint !== undefined &&
    Number(inventory.onHandQty) < Number(inventory.reorderPoint);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{req.title}</h1>
      <ApprovalBanner state={req.state as never} amountPkr={req.amountPkr ?? undefined} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Type</span>
            <span>{req.approvalType}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount</span>
            <Pkr value={req.amountPkr ?? '0'} />
          </div>
          <div className="flex justify-between">
            <span>Source</span>
            <span>
              {req.sourceModule}/{req.sourceRecordId}
            </span>
          </div>
        </CardContent>
      </Card>

      {cash ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entity cash position</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Cash on hand" value={<Pkr value={cash.cashOnHandPkr} mode="lac_crore" />} />
              {Object.entries(cash.bankBalancesPkr).map(([name, val]) => (
                <StatBlock key={name} label={name} value={<Pkr value={val} mode="lac_crore" />} />
              ))}
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--fg-muted)]">Payables aging (PKR)</div>
              <AgingBars buckets={cash.payableAgingPkr} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {recentSimilar.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent similar approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recentSimilar.map((item) => (
                <li key={item.recordId} className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span>{item.vendorOrCounterparty || 'unknown'}</span>
                    <span className="text-xs text-[var(--fg-muted)]">
                      {new Date(item.occurredAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pkr value={item.amountPkr} />
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs ' +
                        (item.outcome === 'rejected'
                          ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
                          : 'bg-[var(--success)]/15 text-[var(--success)]')
                      }
                    >
                      {item.outcome}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {inventory ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <StatBlock
              label="On hand"
              value={
                <span className={belowReorder ? 'text-[var(--danger)]' : ''}>
                  {inventory.onHandQty ?? '0'}
                </span>
              }
            />
            <StatBlock label="Reorder point" value={inventory.reorderPoint ?? 'n/a'} />
            <StatBlock
              label="Days of cover"
              value={
                <span className={lowCover ? 'text-[var(--danger)]' : ''}>
                  {inventory.daysOfCover ?? 'n/a'}
                </span>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {quoteComparison ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quote comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fg-muted)]">
                  <th className="py-1">Workshop</th>
                  <th className="py-1 text-right">Total</th>
                  <th className="py-1 text-right">ETA</th>
                  <th className="py-1 text-right">Warranty</th>
                  <th className="py-1">Selected</th>
                </tr>
              </thead>
              <tbody>
                {quoteComparison.quotes.map((q) => (
                  <tr
                    key={q.quoteId}
                    className={q.selected ? 'bg-[var(--success)]/10 font-medium' : ''}
                  >
                    <td className="py-1">{q.workshopName}</td>
                    <td className="py-1 text-right tabular-nums">
                      <Pkr value={q.totalPkr} />
                    </td>
                    <td className="py-1 text-right tabular-nums">{q.etaDays ?? 'n/a'}</td>
                    <td className="py-1 text-right tabular-nums">{q.warrantyDays ?? 'n/a'}</td>
                    <td className="py-1">
                      {q.selected ? (
                        <span title={q.selectionReason ?? undefined}>yes</span>
                      ) : (
                        'no'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quoteComparison.quotes.find((q) => q.selected)?.selectionReason ? (
              <p className="mt-2 text-xs text-[var(--fg-muted)]">
                Reason: {quoteComparison.quotes.find((q) => q.selected)?.selectionReason}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {thresholds ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Policy thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fg-muted)]">
                  <th className="py-1">Tier</th>
                  <th className="py-1 text-right">Cap (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {(['supervisor', 'farm_manager', 'director'] as const).map((tier) => (
                  <tr
                    key={tier}
                    className={activeTier === tier ? 'bg-[var(--accent)]/10 font-medium' : ''}
                  >
                    <td className="py-1">{tier}</td>
                    <td className="py-1 text-right tabular-nums">
                      {thresholds[tier] === null || thresholds[tier] === undefined
                        ? 'unlimited'
                        : (thresholds[tier] as number).toLocaleString('en-PK')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-[var(--fg-muted)]">
              Requested amount falls into the {activeTier} tier.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {requesterActivity.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requester recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {requesterActivity.map((a, i) => (
                <li key={`${a.occurredAt}-${i}`} className="flex justify-between gap-2">
                  <span>{a.summary}</span>
                  <span className="text-[var(--fg-muted)]">
                    {new Date(a.occurredAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ApprovalExplainer approvalRequestId={req.id} />

      <DecisionPanel approvalRequestId={req.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs">
            {actions.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-300 pl-2">
                <div className="font-medium">{a.action}</div>
                <div className="text-slate-500">
                  {new Date(a.occurredAt).toLocaleString()} - {a.actorRole}
                  {a.comment ? ` - ${a.comment}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
