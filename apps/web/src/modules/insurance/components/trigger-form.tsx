'use client';
import { useState, useTransition } from 'react';
import { createWeatherIndexTrigger, toggleWeatherIndexTrigger, deleteWeatherIndexTrigger } from '@/modules/insurance/trigger-actions';

const KINDS = [
  { value: 'frost_hours', label: 'Frost hours (≤2°C)' },
  { value: 'heat_days', label: 'Heat days (≥40°C max)' },
  { value: 'rainfall_deficit', label: 'Rainfall deficit (mm under normal)' },
  { value: 'rainfall_excess', label: 'Rainfall excess (mm)' },
  { value: 'wind_speed', label: 'Wind speed (kph peak)' },
  { value: 'ndvi_below', label: 'NDVI below threshold' },
  { value: 'soil_moisture_below', label: 'Soil moisture below threshold' },
  { value: 'locust_within_km', label: 'Locust within km' },
] as const;

type Kind = typeof KINDS[number]['value'];

export function TriggerForm({ policyId }: { policyId: string }): React.JSX.Element {
  const [kind, setKind] = useState<Kind>('frost_hours');
  const [threshold, setThreshold] = useState<string>('');
  const [windowDays, setWindowDays] = useState<string>('7');
  const [payoutPerUnit, setPayoutPerUnit] = useState<string>('');
  const [maxPayout, setMaxPayout] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(): void {
    setErr(null);
    start(async () => {
      const res = await createWeatherIndexTrigger({
        policyId,
        triggerKind: kind,
        thresholdValue: Number(threshold),
        measurementWindowDays: Number(windowDays),
        payoutPerUnitPkr: payoutPerUnit ? Number(payoutPerUnit) : undefined,
        maxPayoutPkr: maxPayout ? Number(maxPayout) : undefined,
        notes: notes || undefined,
      });
      if (!res.ok) setErr(res.error);
      else {
        setThreshold('');
        setPayoutPerUnit('');
        setMaxPayout('');
        setNotes('');
      }
    });
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="space-y-1">
          <div className="smallcaps text-[0.65rem]">Trigger kind</div>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="border px-2 py-1 w-full">
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <div className="smallcaps text-[0.65rem]">Threshold value</div>
          <input type="number" step="0.001" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="border px-2 py-1 w-full" />
        </label>
        <label className="space-y-1">
          <div className="smallcaps text-[0.65rem]">Window (days)</div>
          <input type="number" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className="border px-2 py-1 w-full" />
        </label>
        <label className="space-y-1">
          <div className="smallcaps text-[0.65rem]">Payout per unit (PKR)</div>
          <input type="number" step="0.01" value={payoutPerUnit} onChange={(e) => setPayoutPerUnit(e.target.value)} className="border px-2 py-1 w-full" />
        </label>
        <label className="space-y-1">
          <div className="smallcaps text-[0.65rem]">Max payout (PKR)</div>
          <input type="number" step="0.01" value={maxPayout} onChange={(e) => setMaxPayout(e.target.value)} className="border px-2 py-1 w-full" />
        </label>
        <label className="space-y-1 md:col-span-3">
          <div className="smallcaps text-[0.65rem]">Notes</div>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="border px-2 py-1 w-full" />
        </label>
      </div>
      {err && <div className="text-xs text-red-700">{err}</div>}
      <button type="button" onClick={submit} disabled={pending || !threshold} className="rounded-md bg-emerald-700 px-4 py-2 text-white text-sm disabled:opacity-50">
        {pending ? 'Saving…' : 'Add trigger'}
      </button>
    </div>
  );
}

export function TriggerRowActions({ id, isActive }: { id: string; isActive: boolean }): React.JSX.Element {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => start(() => toggleWeatherIndexTrigger(id, !isActive).then())}
        disabled={pending}
        className="text-xs underline"
      >
        {isActive ? 'Pause' : 'Resume'}
      </button>
      <button
        type="button"
        onClick={() => start(() => deleteWeatherIndexTrigger(id).then())}
        disabled={pending}
        className="text-xs text-red-700 underline"
      >
        Delete
      </button>
    </div>
  );
}
