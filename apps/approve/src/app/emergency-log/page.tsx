import { db, approvalRequests } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, ApprovalBanner, Pkr } from '@zameen/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EmergencyLogPage() {
  const rows = await db.select().from(approvalRequests).where(eq(approvalRequests.emergencyExecuted, true)).orderBy(desc(approvalRequests.executedAt)).limit(50);
  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 font-display text-2xl">Emergency-executed</h1>
      <p className="text-sm text-[var(--ink)]/70 mb-4">Items committed without prior approval. Post-facto review required within 48h.</p>
      <ul className="space-y-3">
        {rows.map((r) => {
          const executedAt = r.executedAt ? new Date(r.executedAt).getTime() : Date.now();
          const hoursSince = (Date.now() - executedAt) / 3_600_000;
          const overdue = hoursSince > 48;
          return (
            <li key={r.id}>
              <Link href={`/${r.id}` as never}>
                <Card className={overdue ? 'border-l-4 border-l-[var(--rust)]' : ''}>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="font-body">{r.title}</span>
                      {r.amountPkr ? <Pkr value={r.amountPkr} /> : null}
                    </div>
                    <ApprovalBanner state="emergency_executed" />
                    <div className="text-xs text-[var(--ink)]/60 tabular">
                      {hoursSince.toFixed(0)} hours ago {overdue ? '· OVERDUE' : `· ${(48 - hoursSince).toFixed(0)}h left`}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
