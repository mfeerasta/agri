'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProtocol } from '../../gate/actions';

const ZONES = ['livestock', 'poultry', 'dairy', 'crop', 'storage', 'equipment', 'perimeter'];
const KINDS = [
  'disinfection',
  'quarantine',
  'vaccination_required',
  'clothing_change',
  'footbath',
  'vehicle_wash',
  'traffic_restriction',
  'isolation_period',
  'health_certification',
];
const LEVELS = ['mandatory', 'recommended', 'seasonal', 'conditional'];

export function ProtocolForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [zone, setZone] = useState(ZONES[0]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState(KINDS[0]);
  const [level, setLevel] = useState(LEVELS[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name required');
      return;
    }
    start(async () => {
      const res = await createProtocol({
        zone,
        protocolName: name,
        protocolKind: kind,
        enforcementLevel: level,
        description: description || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName('');
      setDescription('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select className="rounded border p-2" value={zone} onChange={(e) => setZone(e.target.value)}>
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
        <select className="rounded border p-2" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>
      <input className="w-full rounded border p-2" placeholder="Protocol name" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="w-full rounded border p-2" value={level} onChange={(e) => setLevel(e.target.value)}>
        {LEVELS.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>
      <textarea
        className="w-full rounded border p-2"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <div className="text-sm text-red-700">{error}</div>}
      <button onClick={submit} disabled={pending} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">
        {pending ? 'Saving...' : 'Add protocol'}
      </button>
    </div>
  );
}
