'use client';
import * as React from 'react';
import { Pkr, Card } from '@zameen/ui';
import type { PayrollMatrixData, PayrollMatrixCell } from '../payroll-matrix-actions';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface PayrollMatrixProps {
  entityId: string;
  data: PayrollMatrixData;
}

export function PayrollMatrix({ entityId, data }: PayrollMatrixProps): React.JSX.Element {
  const [drawerCell, setDrawerCell] = React.useState<PayrollMatrixCell | null>(null);
  const drawerWorker = drawerCell
    ? data.workers.find((w) => w.id === drawerCell.workerId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">پے رول میٹرکس / Payroll matrix · {data.year}</h2>
          <p className="text-sm text-[var(--muted)]">
            {data.workers.length} workers · کل / Grand total <Pkr value={data.grandTotal} mode="lac_crore" />
          </p>
        </div>
        <a
          href={`/api/labor/payroll-matrix/xlsx?entityId=${entityId}&year=${data.year}`}
          className="text-sm underline"
        >
          ایکسل میں ڈاؤن لوڈ / Download XLSX
        </a>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)] p-2 text-left">
                مزدور / Worker
              </th>
              {data.months.map((m) => (
                <th key={m} className="p-2 text-right whitespace-nowrap">
                  {MONTH_LABELS[m - 1]}
                </th>
              ))}
              <th className="p-2 text-right whitespace-nowrap bg-[var(--accent-soft)]">
                YTD
              </th>
            </tr>
          </thead>
          <tbody>
            {data.workers.length === 0 ? (
              <tr>
                <td
                  colSpan={data.months.length + 2}
                  className="p-6 text-center text-[var(--muted)]"
                >
                  کوئی مزدور نہیں / No workers found.
                </td>
              </tr>
            ) : (
              data.workers.map((w) => (
                <tr key={w.id} className="border-t border-[var(--border)]">
                  <td className="sticky left-0 bg-[var(--surface)] p-2 font-medium whitespace-nowrap">
                    <div>{w.fullName}</div>
                    <div className="text-xs text-[var(--muted)]">{w.code}</div>
                  </td>
                  {data.months.map((m) => {
                    const c = data.cells[`${w.id}|${m}`];
                    return (
                      <td key={m} className="p-2 text-right whitespace-nowrap">
                        {c ? (
                          <button
                            type="button"
                            onClick={() => setDrawerCell(c)}
                            className="underline decoration-dotted hover:bg-[var(--accent-soft)] px-1"
                          >
                            <Pkr value={c.netPkr} />
                          </button>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold bg-[var(--accent-soft)] whitespace-nowrap">
                    <Pkr value={data.yearlyTotals[w.id] ?? 0} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)] font-semibold">
              <td className="sticky left-0 bg-[var(--surface-2)] p-2">
                کل / Monthly total
              </td>
              {data.months.map((m) => (
                <td key={m} className="p-2 text-right whitespace-nowrap">
                  <Pkr value={data.monthlyTotals[m] ?? 0} />
                </td>
              ))}
              <td className="p-2 text-right bg-[var(--accent)] text-[var(--accent-fg)]">
                <Pkr value={data.grandTotal} mode="lac_crore" />
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {drawerCell && drawerWorker ? (
        <PayslipDrawer cell={drawerCell} worker={drawerWorker} onClose={() => setDrawerCell(null)} />
      ) : null}
    </div>
  );
}

function PayslipDrawer({
  cell,
  worker,
  onClose,
}: {
  cell: PayrollMatrixCell;
  worker: PayrollMatrixWorkerLite;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" onClick={onClose} className="flex-1 bg-black/40" aria-label="Close" />
      <div className="w-full max-w-md bg-[var(--surface)] p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">پے سلپ تفصیل / Payslip detail</h3>
          <button type="button" onClick={onClose} className="text-sm underline">
            بند کریں / Close
          </button>
        </div>
        <div className="text-sm space-y-2">
          <div>
            <div className="font-medium">{worker.fullName}</div>
            <div className="text-xs text-[var(--muted)]">
              {worker.code} · Month {cell.month}
            </div>
          </div>
          <Row label="ایام / Days worked" value={cell.daysWorked.toFixed(1)} />
          <Row label="بنیادی تنخواہ / Base salary" pkr={cell.baseSalaryPkr} />
          <Row label="پیس ریٹ / Piece rate" pkr={cell.pieceRateEarningsPkr} />
          <Row label="کٹوتیاں / Deductions" pkr={-cell.deductionsPkr} />
          <Row label="پیشگی / Advances" pkr={-cell.advancesPkr} />
          <div className="border-t pt-2 font-semibold flex justify-between">
            <span>کل ادائیگی / Net pay</span>
            <Pkr value={cell.netPkr} />
          </div>
          {cell.payslipId ? (
            <a
              href={`/api/vouchers/payslip/${cell.payslipId}`}
              target="_blank"
              rel="noreferrer"
              className="block underline mt-3"
            >
              پے سلپ PDF / Download payslip PDF
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface PayrollMatrixWorkerLite {
  id: string;
  code: string;
  fullName: string;
}

function Row({ label, pkr, value }: { label: string; pkr?: number; value?: string }): React.JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      {pkr !== undefined ? <Pkr value={pkr} /> : <span>{value}</span>}
    </div>
  );
}
