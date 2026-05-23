'use client';
import { useMemo } from 'react';

type Schedule = 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'seasonal';

interface Props {
  startDate: string;
  endDate: string | null;
  annualRentPkr: number;
  schedule: Schedule;
  payments: { paidOn: string; amountPkr: number }[];
}

interface Period {
  label: string;
  dueOn: string;
  expectedPkr: number;
  paidPkr: number;
  status: 'green' | 'amber' | 'red' | 'pending';
}

const SCHEDULE_COUNT: Record<Schedule, number> = {
  annual: 1,
  semi_annual: 2,
  quarterly: 4,
  monthly: 12,
  seasonal: 2,
};

function addMonths(d: Date, m: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + m);
  return out;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function LeasePaymentTracker({ startDate, endDate, annualRentPkr, schedule, payments }: Props) {
  const periods = useMemo<Period[]>(() => {
    if (annualRentPkr <= 0) return [];
    const count = SCHEDULE_COUNT[schedule];
    const monthsBetween = 12 / count;
    const perInstallment = annualRentPkr / count;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : addMonths(start, 12);
    const today = new Date();

    const out: Period[] = [];
    let cursor = new Date(start);
    let idx = 1;
    while (cursor <= end && out.length < 60) {
      const dueOn = iso(cursor);
      // Allocate payments that fall in [cursor, cursor + interval)
      const next = addMonths(cursor, monthsBetween);
      const paidPkr = payments
        .filter((p) => p.paidOn >= dueOn && p.paidOn < iso(next))
        .reduce((s, p) => s + p.amountPkr, 0);

      let status: Period['status'] = 'pending';
      if (cursor > today) status = 'pending';
      else if (paidPkr >= perInstallment - 0.01) status = 'green';
      else if (paidPkr > 0) status = 'amber';
      else status = 'red';

      out.push({
        label: `Installment ${idx} (${schedule})`,
        dueOn,
        expectedPkr: Number(perInstallment.toFixed(2)),
        paidPkr: Number(paidPkr.toFixed(2)),
        status,
      });
      cursor = next;
      idx += 1;
    }
    return out;
  }, [startDate, endDate, annualRentPkr, schedule, payments]);

  if (periods.length === 0) {
    return <div className="text-sm text-slate-500">No payment schedule (rent or schedule missing).</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
          <tr><th className="p-2">Period</th><th className="p-2">Due</th><th className="p-2">Expected</th><th className="p-2">Paid</th><th className="p-2">Status</th></tr>
        </thead>
        <tbody>
          {periods.map((p, i) => (
            <tr key={i} className="border-b border-[var(--rule)]">
              <td className="p-2">{p.label}</td>
              <td className="p-2 tabular">{p.dueOn}</td>
              <td className="p-2 tabular">PKR {p.expectedPkr.toLocaleString('en-PK')}</td>
              <td className="p-2 tabular">PKR {p.paidPkr.toLocaleString('en-PK')}</td>
              <td className="p-2">
                <span
                  className={
                    p.status === 'green'
                      ? 'inline-block w-3 h-3 rounded-full bg-emerald-500'
                      : p.status === 'amber'
                        ? 'inline-block w-3 h-3 rounded-full bg-amber-500'
                        : p.status === 'red'
                          ? 'inline-block w-3 h-3 rounded-full bg-red-500'
                          : 'inline-block w-3 h-3 rounded-full bg-slate-300'
                  }
                  aria-label={p.status}
                />
                <span className="ml-2 text-xs">{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
