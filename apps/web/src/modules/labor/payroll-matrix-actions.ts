'use server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db, workers, payrollRuns, payslips } from '@zameen/db';

export interface PayrollMatrixWorker {
  id: string;
  code: string;
  fullName: string;
  fullNameUr: string | null;
}

export interface PayrollMatrixCell {
  workerId: string;
  month: number;
  netPkr: number;
  payslipId: string | null;
  payrollRunId: string | null;
  daysWorked: number;
  baseSalaryPkr: number;
  pieceRateEarningsPkr: number;
  deductionsPkr: number;
  advancesPkr: number;
}

export interface PayrollMatrixData {
  year: number;
  workers: PayrollMatrixWorker[];
  months: number[];
  cells: Record<string, PayrollMatrixCell>;
  monthlyTotals: Record<number, number>;
  yearlyTotals: Record<string, number>;
  grandTotal: number;
}

function cellKey(workerId: string, month: number): string {
  return `${workerId}|${month}`;
}

function monthFromIso(iso: string | Date): number {
  const d = iso instanceof Date ? iso : new Date(iso);
  return d.getUTCMonth() + 1;
}

export async function loadPayrollMatrix({
  entityId,
  year,
}: {
  entityId: string;
  year: number;
}): Promise<PayrollMatrixData> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const workerRows = await db
    .select({
      id: workers.id,
      code: workers.code,
      fullName: workers.fullName,
      fullNameUr: workers.fullNameUr,
    })
    .from(workers)
    .where(eq(workers.entityId, entityId));

  const runs = await db
    .select()
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.entityId, entityId),
        gte(payrollRuns.periodEnd, yearStart),
        lte(payrollRuns.periodEnd, yearEnd),
      ),
    );
  const runIds = runs.map((r) => r.id);
  const runById = new Map(runs.map((r) => [r.id, r]));

  const slips = runIds.length
    ? await db.select().from(payslips)
    : [];
  const slipsInYear = slips.filter((s) => runById.has(s.payrollRunId));

  const months: number[] = Array.from({ length: 12 }, (_, i) => i + 1);
  const cells: Record<string, PayrollMatrixCell> = {};
  const monthlyTotals: Record<number, number> = {};
  const yearlyTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const m of months) monthlyTotals[m] = 0;
  for (const w of workerRows) yearlyTotals[w.id] = 0;

  for (const s of slipsInYear) {
    const run = runById.get(s.payrollRunId);
    if (!run) continue;
    const month = monthFromIso(run.periodEnd);
    const net = Number(s.netPkr);
    const key = cellKey(s.workerId, month);
    const existing = cells[key];
    const cell: PayrollMatrixCell = {
      workerId: s.workerId,
      month,
      netPkr: (existing?.netPkr ?? 0) + net,
      payslipId: s.id,
      payrollRunId: s.payrollRunId,
      daysWorked: (existing?.daysWorked ?? 0) + Number(s.daysWorked),
      baseSalaryPkr: (existing?.baseSalaryPkr ?? 0) + Number(s.baseSalaryPkr),
      pieceRateEarningsPkr:
        (existing?.pieceRateEarningsPkr ?? 0) + Number(s.pieceRateEarningsPkr),
      deductionsPkr: (existing?.deductionsPkr ?? 0) + Number(s.deductionsPkr),
      advancesPkr: (existing?.advancesPkr ?? 0) + Number(s.advancesPkr),
    };
    cells[key] = cell;
    monthlyTotals[month] = (monthlyTotals[month] ?? 0) + net;
    yearlyTotals[s.workerId] = (yearlyTotals[s.workerId] ?? 0) + net;
    grandTotal += net;
  }

  for (const m of months) monthlyTotals[m] = +(monthlyTotals[m] ?? 0).toFixed(2);
  for (const w of workerRows) yearlyTotals[w.id] = +(yearlyTotals[w.id] ?? 0).toFixed(2);

  return {
    year,
    workers: workerRows,
    months,
    cells,
    monthlyTotals,
    yearlyTotals,
    grandTotal: +grandTotal.toFixed(2),
  };
}
