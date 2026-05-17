import Link from 'next/link';
import { db, approvalRequests } from '@zameen/db';
import { desc, inArray } from 'drizzle-orm';
import { Card, CardContent, ApprovalBanner, Pkr } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(inArray(approvalRequests.state, ['approved', 'executed', 'rejected'] as never))
    .orderBy(desc(approvalRequests.decidedAt))
    .limit(100);
  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 font-display text-2xl">Decision history</h1>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/${r.id}` as never}>
              <Card className="hover:bg-[var(--paper-2)]">
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-body">{r.title}</span>
                    {r.amountPkr ? <Pkr value={r.amountPkr} /> : null}
                  </div>
                  <ApprovalBanner state={r.state as never} />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
