'use client';
import * as React from 'react';
import { BigButton, Card, Button, Input } from '@zameen/ui';
import type { MilkMatrix } from '../milk-actions';
import { logMilk } from '../milk-actions';

export interface MilkGridProps {
  data: MilkMatrix;
}

export function MilkGrid({ data }: MilkGridProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  const [colId, setColId] = React.useState<string>(data.columns[0]?.id ?? '');
  const [date, setDate] = React.useState<string>(today);
  const [shift, setShift] = React.useState<'morning' | 'evening'>('morning');
  const [liters, setLiters] = React.useState<string>('');
  const [fatPct, setFatPct] = React.useState<string>('');
  const [snfPct, setSnfPct] = React.useState<string>('');
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!colId || !liters) {
      setErr('سب خانے پُر کریں / Fill required fields');
      return;
    }
    const col = data.columns.find((c) => c.id === colId);
    if (!col) {
      setErr('Invalid column');
      return;
    }
    setBusy(true);
    const res = await logMilk({
      animalId: col.kind === 'animal' ? colId : undefined,
      herdId: col.kind === 'herd' ? colId : undefined,
      logDate: date,
      shift,
      liters: Number(liters),
      fatPct: fatPct ? Number(fatPct) : undefined,
      snfPct: snfPct ? Number(snfPct) : undefined,
      revalidate: '/livestock/milk-log',
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Error');
      return;
    }
    setLiters('');
    setFatPct('');
    setSnfPct('');
    setOpen(false);
    location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">دودھ لاگ / Milk Log</h2>
          <p className="text-sm text-[var(--muted)]">
            {data.fromDate} → {data.toDate} · {data.rows.length} days · کل / Total{' '}
            {data.grandTotal.toFixed(2)} L
          </p>
        </div>
        <BigButton
          tone="primary"
          label="دودھ درج کریں / Log milk"
          sublabel="ایک ٹیپ / One tap"
          onClick={() => setOpen(true)}
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)] p-2 text-left">تاریخ / Date</th>
              {data.columns.map((c) => (
                <th key={c.id} className="p-2 text-right whitespace-nowrap">
                  <div>{c.label}</div>
                  <div className="text-xs font-normal text-[var(--muted)]">
                    {c.kind === 'herd' ? 'herd' : c.species}
                  </div>
                </th>
              ))}
              <th className="p-2 text-right whitespace-nowrap bg-[var(--accent-soft)]">دن کا کل / Day total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length + 2} className="p-6 text-center text-[var(--muted)]">
                  کوئی اندراج نہیں / No entries.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.date} className="border-t border-[var(--border)]">
                  <td className="sticky left-0 bg-[var(--surface)] p-2 font-medium whitespace-nowrap">{r.date}</td>
                  {data.columns.map((c) => {
                    const cell = r.cells[c.id];
                    if (!cell) return <td key={c.id} className="p-2 text-right text-[var(--muted)]">—</td>;
                    const total = cell.morning + cell.evening;
                    return (
                      <td key={c.id} className="p-2 text-right whitespace-nowrap">
                        <div>{total.toFixed(2)} L</div>
                        <div className="text-xs text-[var(--muted)]">
                          AM {cell.morning.toFixed(1)} · PM {cell.evening.toFixed(1)}
                        </div>
                        {cell.fatPct != null ? (
                          <div className="text-xs text-[var(--muted)]">
                            fat {cell.fatPct.toFixed(1)}%{cell.snfPct != null ? ` · snf ${cell.snfPct.toFixed(1)}%` : ''}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold bg-[var(--accent-soft)] whitespace-nowrap">{r.total.toFixed(2)} L</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)] font-semibold">
              <td className="sticky left-0 bg-[var(--surface-2)] p-2">کل / Total</td>
              {data.columns.map((c) => (
                <td key={c.id} className="p-2 text-right whitespace-nowrap">{(data.columnTotals[c.id] ?? 0).toFixed(2)} L</td>
              ))}
              <td className="p-2 text-right bg-[var(--accent)] text-[var(--accent-fg)]">{data.grandTotal.toFixed(2)} L</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <Card className="w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">دودھ کا اندراج / Log milk</h3>

            <label className="block text-sm">
              <span className="block mb-1">جانور یا گلہ / Animal or Herd</span>
              <select value={colId} onChange={(e) => setColId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                {data.columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.kind === 'herd' ? '🐄 ' : ''}{c.label}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">تاریخ / Date</span>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">شفٹ / Shift</span>
                <select value={shift} onChange={(e) => setShift(e.target.value as 'morning' | 'evening')} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                  <option value="morning">صبح / AM</option>
                  <option value="evening">شام / PM</option>
                </select>
              </label>
            </div>

            <label className="block text-sm">
              <span className="block mb-1">لیٹر / Liters</span>
              <Input type="number" inputMode="decimal" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">فیٹ % / Fat %</span>
                <Input type="number" inputMode="decimal" step="0.01" value={fatPct} onChange={(e) => setFatPct(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">SNF %</span>
                <Input type="number" inputMode="decimal" step="0.01" value={snfPct} onChange={(e) => setSnfPct(e.target.value)} />
              </label>
            </div>

            {err ? <div className="text-sm text-red-500">{err}</div> : null}

            <div className="flex gap-2">
              <Button onClick={submit} disabled={busy} className="flex-1">{busy ? '…' : 'محفوظ / Save'}</Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>منسوخ / Cancel</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
