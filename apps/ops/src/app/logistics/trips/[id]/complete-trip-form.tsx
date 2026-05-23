'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeTrip } from '../../actions';

export function CompleteTripForm({ tripId, startKm }: { tripId: string; startKm: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [endKm, setEndKm] = useState('');
  const [liters, setLiters] = useState('');
  const [dieselCost, setDieselCost] = useState('');
  const [toll, setToll] = useState('0');
  const [parking, setParking] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [pod, setPod] = useState('');

  const distance = Math.max(0, Number(endKm || 0) - startKm);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const urls = pod
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setErr('Proof of delivery photo required');
      return;
    }
    start(async () => {
      const res = await completeTrip(tripId, {
        endOdometerKm: Number(endKm),
        distanceKm: distance,
        dieselUsedLiters: Number(liters),
        dieselCostPkr: Number(dieselCost).toFixed(2),
        tollCostPkr: Number(toll).toFixed(2),
        parkingCostPkr: Number(parking).toFixed(2),
        driverAllowancePkr: Number(allowance).toFixed(2),
        proofOfDeliveryUrls: urls,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`End odometer (start ${startKm})`}>
          <input type="number" min={startKm} step="0.01" value={endKm} onChange={(e) => setEndKm(e.target.value)} required className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Distance (km)">
          <input value={distance.toFixed(2)} readOnly className="w-full rounded-sm border bg-[var(--paper-2)] p-2 tabular" />
        </Field>
        <Field label="Diesel used (L)">
          <input type="number" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} required className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Diesel cost (PKR)">
          <input type="number" step="0.01" value={dieselCost} onChange={(e) => setDieselCost(e.target.value)} required className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Toll (PKR)">
          <input type="number" step="0.01" value={toll} onChange={(e) => setToll(e.target.value)} className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Parking (PKR)">
          <input type="number" step="0.01" value={parking} onChange={(e) => setParking(e.target.value)} className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Driver allowance (PKR)">
          <input type="number" step="0.01" value={allowance} onChange={(e) => setAllowance(e.target.value)} className="w-full rounded-sm border p-2 tabular" />
        </Field>
      </div>

      <Field label="Proof of delivery URLs (whitespace separated)">
        <textarea
          value={pod}
          onChange={(e) => setPod(e.target.value)}
          rows={3}
          required
          className="w-full rounded-sm border p-2 text-xs"
          placeholder="https://… https://…"
        />
      </Field>

      {err && <p className="text-sm text-rose-700">{err}</p>}
      <button
        type="submit"
        disabled={pending}
        className="smallcaps w-full rounded-sm bg-[var(--zameen-700)] px-3 py-3 text-[var(--paper)] disabled:opacity-50"
      >
        {pending ? 'Closing…' : 'Complete trip'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">{label}</span>
      {children}
    </label>
  );
}
