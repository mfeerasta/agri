'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOutbreak } from '../../gate/actions';

const KINDS = [
  'fmd',
  'lsd',
  'brucellosis',
  'mastitis',
  'avian_flu',
  'newcastle',
  'ppr',
  'anthrax',
  'clostridial',
  'crop_blight',
  'rust',
  'locust',
  'other',
];

export function OutbreakForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState(KINDS[0]);
  const [detectedOn, setDetectedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [area, setArea] = useState('');
  const [source, setSource] = useState('');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await createOutbreak({
        outbreakKind: kind,
        detectedOn,
        affectedArea: area || undefined,
        sourceSuspected: source || undefined,
        totalAffectedCount: count ? Number(count) : undefined,
        notes: notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setArea('');
      setSource('');
      setCount('');
      setNotes('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select className="rounded border p-2" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input type="date" className="rounded border p-2" value={detectedOn} onChange={(e) => setDetectedOn(e.target.value)} />
      </div>
      <input className="w-full rounded border p-2" placeholder="Affected area" value={area} onChange={(e) => setArea(e.target.value)} />
      <input
        className="w-full rounded border p-2"
        placeholder="Suspected source"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <input
        type="number"
        className="w-full rounded border p-2"
        placeholder="Affected count"
        value={count}
        onChange={(e) => setCount(e.target.value)}
      />
      <textarea className="w-full rounded border p-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button onClick={submit} disabled={pending} className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Saving...' : 'Report outbreak'}
      </button>
    </div>
  );
}
