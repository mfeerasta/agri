'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRoute } from '../../actions';

interface Dest {
  name: string;
  lat: string;
  lng: string;
  mandi: boolean;
}

const SEED_MANDIS: Dest[] = [
  { name: 'Lahore mandi', lat: '31.5497', lng: '74.3436', mandi: true },
  { name: 'Sahiwal mandi', lat: '30.6682', lng: '73.1114', mandi: true },
  { name: 'Okara mandi', lat: '30.8081', lng: '73.4534', mandi: true },
  { name: 'Faisalabad mandi', lat: '31.4180', lng: '73.0791', mandi: true },
];

export function NewRouteForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');
  const [km, setKm] = useState('');
  const [minutes, setMinutes] = useState('');
  const [toll, setToll] = useState('0');
  const [dests, setDests] = useState<Dest[]>([{ name: '', lat: '', lng: '', mandi: true }]);

  function addDest() {
    setDests((d) => [...d, { name: '', lat: '', lng: '', mandi: false }]);
  }
  function pickMandi(idx: number, m: Dest) {
    const next = [...dests];
    next[idx] = m;
    setDests(next);
  }
  function update(idx: number, patch: Partial<Dest>) {
    const next = [...dests];
    next[idx] = { ...next[idx], ...patch };
    setDests(next);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const destinations = dests
      .filter((d) => d.name && d.lat && d.lng)
      .map((d) => ({ name: d.name, lat: Number(d.lat), lng: Number(d.lng), mandi: d.mandi }));
    if (destinations.length === 0) {
      setErr('At least one destination required');
      return;
    }
    start(async () => {
      const res = await createRoute({
        name,
        originLat: Number(originLat),
        originLng: Number(originLng),
        destinations,
        estimatedDistanceKm: km ? Number(km) : undefined,
        estimatedDurationMinutes: minutes ? Number(minutes) : undefined,
        tollCostPkr: Number(toll).toFixed(2),
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push('/logistics/routes');
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-sm border p-2" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Origin lat">
          <input value={originLat} onChange={(e) => setOriginLat(e.target.value)} required className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Origin lng">
          <input value={originLng} onChange={(e) => setOriginLng(e.target.value)} required className="w-full rounded-sm border p-2 tabular" />
        </Field>
      </div>

      <div className="rounded-sm bg-[var(--paper-2)] p-3 space-y-2">
        <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">Destinations</div>
        {dests.map((d, i) => (
          <div key={i} className="space-y-1 border-b border-[var(--rule)] pb-2">
            <div className="flex flex-wrap gap-2 text-xs">
              {SEED_MANDIS.map((m) => (
                <button key={m.name} type="button" onClick={() => pickMandi(i, m)} className="rounded-sm bg-[var(--paper)] px-2 py-1">
                  {m.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input value={d.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" className="rounded-sm border p-1 text-sm" />
              <input value={d.lat} onChange={(e) => update(i, { lat: e.target.value })} placeholder="Lat" className="rounded-sm border p-1 text-sm tabular" />
              <input value={d.lng} onChange={(e) => update(i, { lng: e.target.value })} placeholder="Lng" className="rounded-sm border p-1 text-sm tabular" />
            </div>
          </div>
        ))}
        <button type="button" onClick={addDest} className="smallcaps text-xs text-[var(--zameen-700)]">
          + add destination
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Distance (km)">
          <input value={km} onChange={(e) => setKm(e.target.value)} className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Duration (min)">
          <input value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-full rounded-sm border p-2 tabular" />
        </Field>
        <Field label="Toll (PKR)">
          <input value={toll} onChange={(e) => setToll(e.target.value)} className="w-full rounded-sm border p-2 tabular" />
        </Field>
      </div>

      {err && <p className="text-sm text-rose-700">{err}</p>}
      <button type="submit" disabled={pending} className="smallcaps w-full rounded-sm bg-[var(--zameen-700)] px-3 py-3 text-[var(--paper)] disabled:opacity-50">
        {pending ? 'Saving…' : 'Save route'}
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
