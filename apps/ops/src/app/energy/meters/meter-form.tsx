'use client';
import { useState, useTransition } from 'react';
import { createEnergyMeter } from '../actions';

const KINDS = ['grid_electricity', 'solar_inverter', 'generator', 'tubewell_pump', 'cold_storage', 'farm_kitchen', 'farmhouse', 'other'];
const CONNECTIONS = ['agri', 'commercial', 'domestic', 'industrial', 'solar_net_metering'];

export function MeterForm({ entityId }: { entityId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          const res = await createEnergyMeter({
            entityId,
            meterNumber: String(fd.get('meterNumber') ?? ''),
            meterKind: String(fd.get('meterKind') ?? ''),
            connectionKind: String(fd.get('connectionKind') ?? '') || undefined,
            capacityKw: Number(fd.get('capacityKw')) || undefined,
            tariffPkrPerKwh: Number(fd.get('tariffPkrPerKwh')) || undefined,
            referenceNumber: String(fd.get('referenceNumber') ?? '') || undefined,
          });
          if (!res.ok) setErr(res.error);
        });
      }}
      className="space-y-2"
    >
      <input name="meterNumber" required placeholder="Meter number" className="w-full border rounded px-2 py-1 text-sm" />
      <select name="meterKind" required className="w-full border rounded px-2 py-1 text-sm">
        <option value="">Kind</option>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <select name="connectionKind" className="w-full border rounded px-2 py-1 text-sm">
        <option value="">Connection (optional)</option>
        {CONNECTIONS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <input name="capacityKw" type="number" step="0.001" placeholder="Capacity kW" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="tariffPkrPerKwh" type="number" step="0.0001" placeholder="Tariff PKR/kWh" className="w-full border rounded px-2 py-1 text-sm" />
      <input name="referenceNumber" placeholder="Reference number" className="w-full border rounded px-2 py-1 text-sm" />
      {err && <div className="text-xs text-red-600">{err}</div>}
      <button disabled={pending} className="bg-[var(--zameen-700)] text-white text-sm rounded px-3 py-1">
        {pending ? 'Saving…' : 'Add meter'}
      </button>
    </form>
  );
}
