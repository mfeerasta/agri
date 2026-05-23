'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startTrip, appendGpsPoint, completeTrip } from './actions';

const POLL_MS = 5 * 60 * 1000;

export function TripDriverPanel({
  tripId,
  status,
  startKm,
}: {
  tripId: string;
  status: string;
  startKm: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [liters, setLiters] = useState('');
  const [dieselCost, setDieselCost] = useState('');
  const [pod, setPod] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== 'in_transit') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void appendGpsPoint(tripId, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            ts: new Date().toISOString(),
          });
        },
        () => {
          // GPS denied; silently skip.
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
      );
    };
    send();
    pollRef.current = setInterval(send, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, tripId]);

  function doStart() {
    setErr(null);
    if (!startOdo) {
      setErr('Start odometer required');
      return;
    }
    start(async () => {
      const res = await startTrip(tripId, Number(startOdo));
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  function doComplete() {
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
        endOdometerKm: Number(endOdo),
        dieselUsedLiters: Number(liters),
        dieselCostPkr: Number(dieselCost).toFixed(2),
        proofOfDeliveryUrls: urls,
      });
      if (!res.ok) setErr(res.error);
      else router.push('/trip');
    });
  }

  if (status === 'planned' || status === 'dispatched') {
    return (
      <div className="space-y-3">
        <p className="urdu text-sm">ٹرپ شروع کریں</p>
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="Start odometer (km)"
          value={startOdo}
          onChange={(e) => setStartOdo(e.target.value)}
          className="w-full rounded-sm border p-3 tabular text-lg"
        />
        {err && <p className="text-sm text-rose-700">{err}</p>}
        <button onClick={doStart} disabled={pending} className="smallcaps w-full rounded-sm bg-[var(--zameen-700)] p-4 text-[var(--paper)]">
          شروع کریں
        </button>
      </div>
    );
  }

  if (status === 'in_transit') {
    return (
      <div className="space-y-3">
        <p className="urdu text-sm">ٹرپ جاری ہے — GPS ٹریک ہو رہی ہے</p>
        <div className="tabular text-xs text-[var(--zameen-600)]">Start odometer: {startKm ?? '—'} km</div>
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="End odometer (km)"
          value={endOdo}
          onChange={(e) => setEndOdo(e.target.value)}
          className="w-full rounded-sm border p-3 tabular text-lg"
        />
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder="Diesel used (L)"
          value={liters}
          onChange={(e) => setLiters(e.target.value)}
          className="w-full rounded-sm border p-3 tabular text-lg"
        />
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="Diesel cost (PKR)"
          value={dieselCost}
          onChange={(e) => setDieselCost(e.target.value)}
          className="w-full rounded-sm border p-3 tabular text-lg"
        />
        <textarea
          rows={2}
          placeholder="Proof of delivery photo URL(s)"
          value={pod}
          onChange={(e) => setPod(e.target.value)}
          className="w-full rounded-sm border p-3 text-sm"
        />
        {err && <p className="text-sm text-rose-700">{err}</p>}
        <button onClick={doComplete} disabled={pending} className="smallcaps w-full rounded-sm bg-[var(--zameen-700)] p-4 text-[var(--paper)]">
          مکمل کریں
        </button>
      </div>
    );
  }

  return <p className="urdu text-sm">ٹرپ {status}</p>;
}
