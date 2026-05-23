'use client';
import * as React from 'react';
import { BigButton, Pkr, Card, Button, Input } from '@zameen/ui';
import type { FeedMatrix } from '../feed-actions';
import { getLatestFeedUnitCost, issueFeed } from '../feed-actions';

export interface FeedGridProps {
  entityId: string;
  data: FeedMatrix;
}

export function FeedGrid({ entityId, data }: FeedGridProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  const [colId, setColId] = React.useState<string>(data.columns[0]?.id ?? '');
  const [inputId, setInputId] = React.useState<string>(data.inputs[0]?.id ?? '');
  const [date, setDate] = React.useState<string>(today);
  const [qty, setQty] = React.useState<string>('');
  const [unitCost, setUnitCost] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!inputId) return;
    getLatestFeedUnitCost(inputId).then((c) => {
      if (c != null && !unitCost) setUnitCost(String(c));
    });
  }, [inputId]);

  const total = Number(qty || 0) * Number(unitCost || 0);

  async function submit() {
    setErr(null);
    if (!colId || !inputId || !qty || !unitCost) {
      setErr('سب خانے پُر کریں / Fill all fields');
      return;
    }
    const col = data.columns.find((c) => c.id === colId);
    if (!col) {
      setErr('Invalid target');
      return;
    }
    setBusy(true);
    const res = await issueFeed({
      entityId,
      inputId,
      herdId: col.kind === 'herd' ? colId : undefined,
      animalId: col.kind === 'animal' ? colId : undefined,
      issuedOn: new Date(date).toISOString(),
      quantity: Number(qty),
      unitCostPkr: Number(unitCost),
      notes: notes || undefined,
      revalidate: '/livestock/feed-log',
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Error');
      return;
    }
    setQty('');
    setNotes('');
    setOpen(false);
    location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">فیڈ لاگ / Feed Log</h2>
          <p className="text-sm text-[var(--muted)]">
            {data.fromDate} → {data.toDate} · کل / Total <Pkr value={data.grandTotal} />
          </p>
        </div>
        <BigButton
          tone="primary"
          label="فیڈ درج کریں / Record feed"
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
                  <div className="text-xs font-normal text-[var(--muted)]">{c.kind}</div>
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
                    return (
                      <td key={c.id} className="p-2 text-right whitespace-nowrap">
                        {cell ? (
                          <>
                            <Pkr value={cell.totalPkr} />
                            <div className="text-xs text-[var(--muted)]">{cell.qty.toFixed(1)} {cell.unit}</div>
                          </>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-semibold bg-[var(--accent-soft)] whitespace-nowrap"><Pkr value={r.total} /></td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)] font-semibold">
              <td className="sticky left-0 bg-[var(--surface-2)] p-2">کل / Total</td>
              {data.columns.map((c) => (
                <td key={c.id} className="p-2 text-right whitespace-nowrap"><Pkr value={data.columnTotals[c.id] ?? 0} /></td>
              ))}
              <td className="p-2 text-right bg-[var(--accent)] text-[var(--accent-fg)]"><Pkr value={data.grandTotal} /></td>
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
            <h3 className="text-lg font-semibold">فیڈ کا اندراج / Issue feed</h3>

            <label className="block text-sm">
              <span className="block mb-1">گلہ یا جانور / Herd or Animal</span>
              <select value={colId} onChange={(e) => setColId(e.target.value)} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                {data.columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.kind === 'herd' ? '🐄 ' : ''}{c.label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1">فیڈ / Feed</span>
              <select value={inputId} onChange={(e) => { setInputId(e.target.value); setUnitCost(''); }} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2">
                {data.inputs.map((i) => (
                  <option key={i.id} value={i.id}>{i.nameUr ?? i.name} ({i.unit})</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block mb-1">تاریخ / Date</span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="block mb-1">مقدار / Qty</span>
                <Input type="number" inputMode="decimal" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1">فی یونٹ ریٹ / Rate</span>
                <Input type="number" inputMode="decimal" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              </label>
            </div>

            <div className="rounded-md bg-[var(--surface-2)] p-2 text-sm">کل / Total: <Pkr value={total} /></div>

            <label className="block text-sm">
              <span className="block mb-1">نوٹس / Notes (optional)</span>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

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
