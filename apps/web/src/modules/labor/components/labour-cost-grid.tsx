'use client';
import * as React from 'react';
import Link from 'next/link';
import { Pkr, Card, Button } from '@zameen/ui';
import type { LabourCostLogData } from '../labour-cost-log-actions';

export interface LabourCostGridProps {
  entityId: string;
  data: LabourCostLogData;
}

export function LabourCostGrid({ entityId, data }: LabourCostGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">مزدوری لاگت لاگ / Labour cost log</h2>
          <p className="text-sm text-[var(--muted)]">
            {data.fromDate} → {data.toDate} · {data.rows.length} days ·{' '}
            {data.grandTotalHours.toFixed(1)} hrs · کل / Total{' '}
            <Pkr value={data.grandTotalPkr} />
          </p>
        </div>
        <Link href={'/labor/attendance' as never}>
          <Button>حاضری درج کریں / Record attendance</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)] p-2 text-left">
                تاریخ / Date
              </th>
              {data.fields.map((f) => (
                <th key={f.id} className="p-2 text-right whitespace-nowrap">
                  {f.code}
                  <div className="text-xs font-normal text-[var(--muted)]">
                    {f.acres.toFixed(2)} ac
                  </div>
                </th>
              ))}
              <th className="p-2 text-right whitespace-nowrap bg-[var(--accent-soft)]">
                دن کا کل / Day total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.fields.length + 2}
                  className="p-6 text-center text-[var(--muted)]"
                >
                  کوئی اندراج نہیں / No labour entries in this period.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.date} className="border-t border-[var(--border)]">
                  <td className="sticky left-0 bg-[var(--surface)] p-2 font-medium whitespace-nowrap">
                    {r.date}
                  </td>
                  {data.fields.map((f) => {
                    const c = r.perField[f.id];
                    return (
                      <td key={f.id} className="p-2 text-right whitespace-nowrap">
                        {c ? (
                          <>
                            <Pkr value={c.totalPkr} />
                            <div className="text-xs text-[var(--muted)]">
                              {c.hours.toFixed(1)} hrs · {c.workerCount} workers
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold bg-[var(--accent-soft)] whitespace-nowrap">
                    <Pkr value={r.totalPkr} />
                    <div className="text-xs font-normal text-[var(--muted)]">
                      {r.totalHours.toFixed(1)} hrs
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)] font-semibold">
              <td className="sticky left-0 bg-[var(--surface-2)] p-2">
                کھیت کا کل / Field total
              </td>
              {data.fields.map((f) => {
                const ft = data.fieldTotals[f.id];
                const total = ft?.totalPkr ?? 0;
                const perAcre = ft?.perAcrePkr ?? 0;
                const hours = ft?.totalHours ?? 0;
                return (
                  <td key={f.id} className="p-2 text-right whitespace-nowrap">
                    <Pkr value={total} />
                    <div className="text-xs font-normal text-[var(--muted)]">
                      <Pkr value={perAcre} />/ac · {hours.toFixed(1)} hrs
                    </div>
                  </td>
                );
              })}
              <td className="p-2 text-right bg-[var(--accent)] text-[var(--accent-fg)]">
                <Pkr value={data.grandTotalPkr} />
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <ProductivityChart data={data} />

      <div>
        <a
          href={`/api/labor/labour-cost-log/xlsx?entityId=${entityId}&from=${data.fromDate}&to=${data.toDate}`}
          className="text-sm underline"
        >
          ایکسل میں ڈاؤن لوڈ / Download XLSX
        </a>
      </div>
    </div>
  );
}

function ProductivityChart({ data }: { data: LabourCostLogData }) {
  const series = data.productivity.filter((s) => s.points.length > 0);
  if (series.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">
        مزدوری کارکردگی / Labour productivity (PKR per acre per day)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {series.map((s) => {
          const max = Math.max(...s.points.map((p) => p.pkrPerAcre), 1);
          return (
            <div key={s.fieldId} className="rounded-md border border-[var(--border)] p-3">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">{s.fieldCode}</div>
                <div className="text-xs text-[var(--muted)]">{s.acres.toFixed(2)} ac</div>
              </div>
              <div className="text-xs text-[var(--muted)] mb-2">
                avg <Pkr value={s.meanPkrPerAcre} />
                /ac · σ <Pkr value={s.stdDevPkrPerAcre} />
              </div>
              <div className="flex items-end gap-0.5 h-16">
                {s.points.map((p) => {
                  const h = max > 0 ? Math.max(2, (p.pkrPerAcre / max) * 64) : 2;
                  return (
                    <div
                      key={p.date}
                      title={`${p.date}: PKR ${p.pkrPerAcre.toLocaleString()}/ac${
                        p.isOutlier ? ' (outlier)' : ''
                      }`}
                      className={
                        p.isOutlier
                          ? 'flex-1 bg-red-500 min-w-[3px]'
                          : 'flex-1 bg-[var(--accent)] min-w-[3px]'
                      }
                      style={{ height: `${h}px` }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[var(--muted)] mt-3">
        Red bars indicate outlier days (more than 2 standard deviations from mean).
      </p>
    </Card>
  );
}
