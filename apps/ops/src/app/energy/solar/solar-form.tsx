'use client';
import { useState, useTransition } from 'react';
import { createSolarSystem } from '../actions';

export function SolarForm({ entityId }: { entityId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          const res = await createSolarSystem({
            entityId,
            installationName: String(fd.get('installationName') ?? ''),
            panelsCount: Number(fd.get('panelsCount')) || 0,
            totalCapacityKw: Number(fd.get('totalCapacityKw')) || 0,
            panelModel: String(fd.get('panelModel') ?? '') || undefined,
            inverterModel: String(fd.get('inverterModel') ?? '') || undefined,
            batteryCapacityKwh: Number(fd.get('batteryCapacityKwh')) || undefined,
            installer: String(fd.get('installer') ?? '') || undefined,
            commissionedOn: String(fd.get('commissionedOn') ?? ''),
            warrantyUntil: String(fd.get('warrantyUntil') ?? '') || undefined,
            costPkr: Number(fd.get('costPkr')) || undefined,
            estimatedAnnualGenerationKwh: Number(fd.get('estimatedAnnualGenerationKwh')) || undefined,
            netMeteringApproved: fd.get('netMeteringApproved') === 'on',
            notes: String(fd.get('notes') ?? '') || undefined,
          });
          if (!res.ok) setErr(res.error);
        });
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-2"
    >
      <input name="installationName" required placeholder="Installation name" className="border rounded px-2 py-1 text-sm" />
      <input name="installer" placeholder="Installer" className="border rounded px-2 py-1 text-sm" />
      <input name="panelsCount" type="number" required placeholder="Panels count" className="border rounded px-2 py-1 text-sm" />
      <input name="totalCapacityKw" type="number" step="0.001" required placeholder="Total capacity kW" className="border rounded px-2 py-1 text-sm" />
      <input name="panelModel" placeholder="Panel model" className="border rounded px-2 py-1 text-sm" />
      <input name="inverterModel" placeholder="Inverter model" className="border rounded px-2 py-1 text-sm" />
      <input name="batteryCapacityKwh" type="number" step="0.001" placeholder="Battery kWh" className="border rounded px-2 py-1 text-sm" />
      <input name="commissionedOn" type="date" required placeholder="Commissioned on" className="border rounded px-2 py-1 text-sm" />
      <input name="warrantyUntil" type="date" placeholder="Warranty until" className="border rounded px-2 py-1 text-sm" />
      <input name="costPkr" type="number" step="0.01" placeholder="Cost PKR" className="border rounded px-2 py-1 text-sm" />
      <input name="estimatedAnnualGenerationKwh" type="number" step="0.01" placeholder="Est. annual kWh" className="border rounded px-2 py-1 text-sm" />
      <label className="text-sm flex items-center gap-2">
        <input name="netMeteringApproved" type="checkbox" /> Net metering approved
      </label>
      <input name="notes" placeholder="Notes" className="border rounded px-2 py-1 text-sm md:col-span-2" />
      {err && <div className="text-xs text-red-600 md:col-span-2">{err}</div>}
      <button disabled={pending} className="bg-[var(--zameen-700)] text-white text-sm rounded px-3 py-1 md:col-span-2">
        {pending ? 'Saving…' : 'Register solar system'}
      </button>
    </form>
  );
}
