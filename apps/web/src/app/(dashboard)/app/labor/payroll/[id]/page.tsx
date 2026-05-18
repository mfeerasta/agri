import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, payrollRuns, payslips } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr, StatBlock } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PayrollDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);
  if (!run) notFound();
  const slips = await db.select().from(payslips).where(eq(payslips.payrollRunId, id));

  return (
    <div>
      <Masthead section="PAYROLL RUN" />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)] mb-6">
        <StatBlock label="Period start" value={fmtDate(run.periodStart)} />
        <StatBlock label="Period end" value={fmtDate(run.periodEnd)} />
        <StatBlock label="Payslips" value={slips.length} />
        <StatBlock label="Total" value={<Pkr value={run.totalPkr} mode="lac_crore" />} />
      </div>
      <Card>
        <CardHeader><CardTitle>Payslips</CardTitle></CardHeader>
        <CardContent className="p-0">
          {slips.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No payslips generated.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Worker</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Days</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Base</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Piece rate</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Net</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{s.workerId.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-right tabular">{s.daysWorked}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={s.baseSalaryPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={s.pieceRateEarningsPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={s.netPkr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
