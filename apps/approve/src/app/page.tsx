import Link from 'next/link';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { db, approvalRequests } from '@zameen/db';
import { ApprovalBanner, Card, CardContent, CardHeader, CardTitle, Pkr } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function ApproverQueuePage() {
  // TODO: scope by current_approver_id = auth.uid() once auth is wired.
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(and(inArray(approvalRequests.state, ['submitted', 'in_review'] as never), isNull(approvalRequests.decidedAt)))
    .limit(50);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Pending approvals</h1>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">No pending approvals. Good work.</CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/${r.id}` as never}>
                <Card className="transition hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base">{r.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ApprovalBanner state={r.state as never} amountPkr={r.amountPkr ?? undefined} />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{r.approvalType}</span>
                      <Pkr value={r.amountPkr ?? '0'} mode="lac_crore" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
