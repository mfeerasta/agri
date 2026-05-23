'use client';
import { useState, useTransition } from 'react';
import { recordEnergyReading } from '../actions';

export function ReadingForm({ meters }: { meters: Array<{ id: string; label: string }> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          const res = await recordEnergyReading({
            meterId: String(fd.get('meterId') ?? ''),
            readingDate: String(fd.get('readingDate') ?? today),
            readingTime: String(fd.get('readingTime') ?? 'total'),
            readingValue: Number(fd.get('readingValue')) || 0,
            consumptionKwh: Number(fd.get('consumptionKwh')) || undefined,
            generationKwh: Number(fd.get('generationKwh')) || undefined,
            exportKwh: Number(fd.get('exportKwh')) || undefined,
            costPkr: Number(fd.get('costPkr')) || undefined,
            billUrl: String(fd.get('billUrl') ?? '') || undefined,
            notes: String(fd.get('notes') ?? '') || undefined,
          });
          if (!res.ok) setErr(res.error);
        });
      }}
      className="space-y-2"
    >
      <select name="meterId" required className="w-full border rounded px-2 py-1 text-sm">
        <option value="">Select meter</option>
        {meters.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <input name="readingDate" type="date" defaultValue={today} className="w-full border rounded px-2 py-1 text-sm" />
      <select name="readingTime" className="w-full border rounded px-2 py-1 text-sm">
        <option value="total">total</option>
        <option value="on_peak">on_peak</option>
        <option value="off_peak">off_peak</option>
      </select>
      <input name="readingValue" type="number" step="0.001" placeholder="Meter reading value" required className="w-full border rounded px-2 py-1 text-sm" />
      <input name="consumptionKwh" type="number" step="0.001" placeholder="Consumption kWh (this period)" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="generationKwh" type="number" step="0.001" placeholder="Generation kWh (this period)" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="exportKwh" type="number" step="0.001" placeholder="Export kWh (net metering)" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="costPkr" type="number" step="0.01" placeholder="Cost PKR (auto-allocates to electricity)" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="billUrl" placeholder="Bill photo URL" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="notes" placeholder="Notes" className="w-full border rounded px-2 py-1 text-sm" />
      {err && <div className="text-xs text-red-600">{err}</div>}
      <button disabled={pending} className="bg-[var(--zameen-700)] text-white text-sm rounded px-3 py-1">
        {pending ? 'Saving…' : 'Record reading'}
      </button>
    </form>
  );
}
