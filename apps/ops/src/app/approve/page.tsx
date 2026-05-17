import { and, eq, inArray } from 'drizzle-orm';
import { db, approvalRequests } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, EmptyState, ApprovalBanner, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { InlineDecision } from './inline-decision';

export const dynamic = 'force-dynamic';

export default async function OpsApprove() {
  const ctx = await getSessionContext();
  if (!ctx?.userId) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Masthead section="Approvals" />
        <EmptyState title="Sign in to see approvals" />
      </div>
    );
  }

  const rows = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.currentApproverId, ctx.userId),
        inArray(approvalRequests.state, ['submitted', 'in_review'] as never),
      ),
    )
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section="My Approvals" />
      {rows.length === 0 ? (
        <EmptyState title="Inbox zero" body="Sub-threshold approvals routed to you appear here." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ApprovalBanner state={r.state as never} amountPkr={r.amountPkr ?? undefined} />
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--ink)]/70">{r.approvalType}</span>
                    <Pkr value={r.amountPkr ?? '0'} mode="lac_crore" />
                  </div>
                  <InlineDecision approvalRequestId={r.id} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
