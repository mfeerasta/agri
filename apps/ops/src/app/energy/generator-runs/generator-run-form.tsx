'use client';
import { useState, useTransition } from 'react';
import { recordGeneratorRun } from '../actions';

const REASONS = ['grid_outage', 'peak_shaving', 'testing', 'planned_maintenance', 'event', 'other'];

export function GeneratorRunForm({ assets }: { assets: Array<{ id: string; label: string }> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          const res = await recordGeneratorRun({
            assetId: String(fd.get('assetId') ?? ''),
            startedAt: String(fd.get('startedAt') ?? new Date().toISOString()),
            endedAt: String(fd.get('endedAt') ?? '') || undefined,
            hoursRun: Number(fd.get('hoursRun')) || undefined,
            dieselConsumedLiters: Number(fd.get('dieselConsumedLiters')) || undefined,
            outputKwhEstimated: Number(fd.get('outputKwhEstimated')) || undefined,
            reason: String(fd.get('reason') ?? '') || undefined,
            fuelCostPkr: Number(fd.get('fuelCostPkr')) || undefined,
            notes: String(fd.get('notes') ?? '') || undefined,
          });
          if (!res.ok) setErr(res.error);
        });
      }}
      className="space-y-2"
    >
      <select name="assetId" required className="w-full border rounded px-2 py-1 text-sm">
        <option value="">Select generator</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <input name="startedAt" type="datetime-local" required className="w-full border rounded px-2 py-1 text-sm" />
      <input name="endedAt" type="datetime-local" placeholder="Ended at" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="hoursRun" type="number" step="0.1" placeholder="Hours run" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="dieselConsumedLiters" type="number" step="0.01" placeholder="Diesel consumed (L)" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="outputKwhEstimated" type="number" step="0.01" placeholder="Output kWh est." className="w-full border rounded px-2 py-1 text-sm" />
      <select name="reason" className="w-full border rounded px-2 py-1 text-sm">
        <option value="">Reason</option>
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input name="fuelCostPkr" type="number" step="0.01" placeholder="Fuel cost PKR" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="notes" placeholder="Notes" className="w-full border rounded px-2 py-1 text-sm" />
      {err && <div className="text-xs text-red-600">{err}</div>}
      <button disabled={pending} className="bg-[var(--zameen-700)] text-white text-sm rounded px-3 py-1">
        {pending ? 'Saving…' : 'Log run'}
      </button>
    </form>
  );
}
