'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '../../actions';

interface Option {
  id: string;
  label: string;
}
interface VehicleOption extends Option {
  fuelEconomy: number | null;
  capacityKg: number | null;
}
interface RouteOption extends Option {
  km: number | null;
  tollPkr: number;
}
interface LotOption extends Option {
  availableKg: number;
}

const DIESEL_RATE_PKR = 290;

export function NewTripForm({
  vehicles,
  drivers,
  routes,
  produceLots,
}: {
  vehicles: VehicleOption[];
  drivers: Option[];
  routes: RouteOption[];
  produceLots: LotOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [purpose, setPurpose] = useState('mandi_delivery');
  const [cargo, setCargo] = useState('');
  const [allowance, setAllowance] = useState('0');
  const [lotPicks, setLotPicks] = useState<Record<string, string>>({});

  const veh = vehicles.find((v) => v.id === vehicleId);
  const route = routes.find((r) => r.id === routeId);
  const km = route?.km ?? 0;
  const economy = veh?.fuelEconomy ?? 0;
  const expectedLiters = economy > 0 && km > 0 ? +(km / economy).toFixed(2) : 0;
  const expectedDieselPkr = +(expectedLiters * DIESEL_RATE_PKR).toFixed(2);
  const expectedToll = route?.tollPkr ?? 0;
  const expectedTotal = expectedDieselPkr + expectedToll + Number(allowance || 0);
  const totalLoadKg = useMemo(
    () => Object.values(lotPicks).reduce((a, b) => a + Number(b || 0), 0),
    [lotPicks],
  );
  const overCapacity = veh?.capacityKg ? totalLoadKg > veh.capacityKg : false;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const loadPlan = Object.entries(lotPicks)
      .filter(([, v]) => Number(v) > 0)
      .map(([id, kg], idx) => ({ produceLotId: id, kgLoaded: Number(kg), loadOrder: idx }));
    start(async () => {
      const res = await createTrip({
        vehicleId: vehicleId || undefined,
        driverId: driverId || undefined,
        routeId: routeId || undefined,
        tripPurpose: purpose,
        cargoDescription: cargo,
        cargoWeightKg: totalLoadKg || undefined,
        loadPlan,
        expectedDieselLiters: expectedLiters,
        expectedDieselCostPkr: expectedDieselPkr.toFixed(2),
        expectedTollPkr: expectedToll.toFixed(2),
        expectedAllowancePkr: Number(allowance || 0).toFixed(2),
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push(`/logistics/trips/${res.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Vehicle">
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full rounded-sm border p-2">
          <option value="">— pick —</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} ({v.fuelEconomy ?? '?'} km/L)
            </option>
          ))}
        </select>
      </Field>

      <Field label="Driver">
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full rounded-sm border p-2">
          <option value="">— pick —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Route">
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="w-full rounded-sm border p-2">
          <option value="">— pick —</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} {r.km ? `(${r.km} km)` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Purpose">
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-sm border p-2">
          {['mandi_delivery', 'input_procurement', 'inter_farm', 'emergency', 'passenger', 'market_research', 'other'].map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Cargo description">
        <input value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full rounded-sm border p-2" />
      </Field>

      <div className="rounded-sm bg-[var(--paper-2)] p-3">
        <div className="smallcaps mb-2 text-[0.65rem] text-[var(--zameen-600)]">Produce lots</div>
        <div className="space-y-2">
          {produceLots.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
              <div>
                {l.label} <span className="text-[var(--zameen-600)]">({l.availableKg} kg available)</span>
              </div>
              <input
                type="number"
                min={0}
                max={l.availableKg}
                value={lotPicks[l.id] ?? ''}
                onChange={(e) => setLotPicks({ ...lotPicks, [l.id]: e.target.value })}
                placeholder="kg"
                className="w-24 rounded-sm border p-1 text-right tabular"
              />
            </div>
          ))}
          {produceLots.length === 0 && <p className="text-xs text-[var(--zameen-600)]">No on-hand lots.</p>}
        </div>
        <div className="tabular mt-2 text-xs">
          Total load: {totalLoadKg.toLocaleString()} kg
          {veh?.capacityKg && ` / ${veh.capacityKg.toLocaleString()} kg`}
          {overCapacity && <span className="ml-2 text-rose-700">over capacity</span>}
        </div>
      </div>

      <Field label="Driver allowance (PKR)">
        <input
          type="number"
          min={0}
          step="0.01"
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
          className="w-full rounded-sm border p-2 tabular"
        />
      </Field>

      <div className="rounded-sm bg-[var(--paper-2)] p-3 text-sm">
        <div className="smallcaps mb-1 text-[0.65rem] text-[var(--zameen-600)]">Estimate</div>
        <div className="grid grid-cols-2 gap-1 tabular">
          <div>Distance</div>
          <div className="text-right">{km} km</div>
          <div>Diesel expected</div>
          <div className="text-right">{expectedLiters} L</div>
          <div>Diesel cost</div>
          <div className="text-right">PKR {expectedDieselPkr.toLocaleString()}</div>
          <div>Toll</div>
          <div className="text-right">PKR {expectedToll.toLocaleString()}</div>
          <div>Allowance</div>
          <div className="text-right">PKR {Number(allowance || 0).toLocaleString()}</div>
          <div className="font-semibold">Total</div>
          <div className="text-right font-semibold">PKR {expectedTotal.toLocaleString()}</div>
        </div>
      </div>

      {err && <p className="text-sm text-rose-700">{err}</p>}

      <button
        type="submit"
        disabled={pending || overCapacity}
        className="smallcaps w-full rounded-sm bg-[var(--zameen-700)] px-3 py-3 text-[var(--paper)] disabled:opacity-50"
      >
        {pending ? 'Dispatching…' : 'Dispatch'}
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
