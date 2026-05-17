import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, approvalRequests, approvalActions } from '@zameen/db';
import { ApprovalBanner, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';
import { DecisionPanel } from './decision-panel';

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1);
  if (!req) notFound();
  const actions = await db
    .select()
    .from(approvalActions)
    .where(eq(approvalActions.approvalRequestId, id))
    .orderBy(desc(approvalActions.occurredAt));

  const ctx = (req.contextSnapshot ?? {}) as Record<string, unknown>;
  const cash = ctx.cashPosition as { cashOnHandPkr?: string } | undefined;

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">{req.title}</h1>
      <ApprovalBanner state={req.state as never} amountPkr={req.amountPkr ?? undefined} />

      <Card>
        <CardHeader><CardTitle className="text-base">Request</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Type</span><span>{req.approvalType}</span></div>
          <div className="flex justify-between"><span>Amount</span><Pkr value={req.amountPkr ?? '0'} /></div>
          <div className="flex justify-between"><span>Source</span><span>{req.sourceModule}/{req.sourceRecordId}</span></div>
        </CardContent>
      </Card>

      {cash ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Entity cash position</CardTitle></CardHeader>
          <CardContent>
            <Pkr value={cash.cashOnHandPkr ?? '0'} mode="lac_crore" />
          </CardContent>
        </Card>
      ) : null}

      <DecisionPanel approvalRequestId={req.id} />

      <Card>
        <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs">
            {actions.map((a) => (
              <li key={a.id} className="border-l-2 border-slate-300 pl-2">
                <div className="font-medium">{a.action}</div>
                <div className="text-slate-500">
                  {new Date(a.occurredAt).toLocaleString()} — {a.actorRole}
                  {a.comment ? ` — ${a.comment}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
