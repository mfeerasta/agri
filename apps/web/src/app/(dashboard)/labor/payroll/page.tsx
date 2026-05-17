import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { db, payrollRuns } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr, ApprovalBanner } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PayrollListPage() {
  const rows = await db.select().from(payrollRuns).orderBy(desc(payrollRuns.runAt)).limit(50);
  return (
    <div>
      <Masthead section="PAYROLL" />
      <SectionDivider />
      <div className="flex justify-between items-center mb-3">
        <div className="smallcaps text-xs text-[var(--ink)]/70">Runs · {rows.length}</div>
        <Link href={'/labor/payroll/new' as never} className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]">New run</Link>
      </div>
      {rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-[var(--ink)]/50">No payroll runs yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.id} href={`/labor/payroll/${r.id}` as never} className="block">
              <Card className="hover:bg-[var(--paper-2)] transition-colors">
                <CardHeader className="flex justify-between items-baseline">
                  <CardTitle>{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</CardTitle>
                  <Pkr value={r.totalPkr} mode="lac_crore" />
                </CardHeader>
                <CardContent>
                  <ApprovalBanner state={(r.status === 'pending_approval' ? 'submitted' : r.status === 'approved' ? 'approved' : 'draft') as never} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
