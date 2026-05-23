'use client';
import { useState, useTransition } from 'react';
import { logIrrigationEvent } from './actions';

interface FieldLite { id: string; label: string }
interface SourceLite { id: string; label: string; kind: string }

interface Props {
  fields: FieldLite[];
  sources: SourceLite[];
}

export function IrrigationLogForm({ fields, sources }: Props) {
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? '');
  const [waterSourceId, setWaterSourceId] = useState(sources[0]?.id ?? '');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 16));
  const [endedAt, setEndedAt] = useState('');
  const [method, setMethod] = useState<'flood' | 'furrow' | 'sprinkler' | 'drip' | 'basin'>('flood');
  const [depthMm, setDepthMm] = useState('');
  const [dieselLiters, setDieselLiters] = useState('');
  const [dieselLogId, setDieselLogId] = useState('');
  const [costPkr, setCostPkr] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selectedSource = sources.find((s) => s.id === waterSourceId);
  const isTubewell = selectedSource?.kind?.toLowerCase().includes('tube') ?? false;

  const submit = () => {
    setMsg(null);
    if (!fieldId || !waterSourceId || !startedAt) {
      setMsg('Field, source, and start time are required');
      return;
    }
    start(async () => {
      const res = await logIrrigationEvent({
        fieldId,
        waterSourceId,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: endedAt ? new Date(endedAt).toISOString() : undefined,
        method,
        estimatedDepthMm: depthMm ? Number(depthMm) : undefined,
        dieselUsedLiters: dieselLiters ? Number(dieselLiters) : undefined,
        dieselLogId: dieselLogId || undefined,
        costPkr: costPkr ? Number(costPkr) : undefined,
        notes: notes || undefined,
        photoUrls,
      });
      if (!res.ok) setMsg(res.error);
      else {
        setMsg('Logged');
        setEndedAt('');
        setDepthMm('');
        setDieselLiters('');
        setDieselLogId('');
        setCostPkr('');
        setNotes('');
        setPhotoUrls([]);
      }
    });
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="smallcaps text-xs">Field</span>
          <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1">
            {fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-xs">Water source</span>
          <select value={waterSourceId} onChange={(e) => setWaterSourceId(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1">
            {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-xs">Started at</span>
          <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
        </label>
        <label className="block">
          <span className="smallcaps text-xs">Ended at</span>
          <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
        </label>
        <label className="block">
          <span className="smallcaps text-xs">Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="block w-full rounded border border-[var(--rule)] p-1">
            <option value="flood">Flood</option>
            <option value="furrow">Furrow</option>
            <option value="sprinkler">Sprinkler</option>
            <option value="drip">Drip</option>
            <option value="basin">Basin</option>
          </select>
        </label>
        <label className="block">
          <span className="smallcaps text-xs">Depth (mm)</span>
          <input type="number" step="0.1" value={depthMm} onChange={(e) => setDepthMm(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
        </label>
      </div>

      {isTubewell && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3">
          <div className="smallcaps mb-2 text-xs text-amber-900">Tubewell — diesel link</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="smallcaps text-xs">Diesel used (L)</span>
              <input type="number" step="0.1" value={dieselLiters} onChange={(e) => setDieselLiters(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-xs">Diesel log ID</span>
              <input type="text" value={dieselLogId} onChange={(e) => setDieselLogId(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" placeholder="optional uuid" />
            </label>
          </div>
        </div>
      )}

      <label className="block">
        <span className="smallcaps text-xs">Cost (PKR)</span>
        <input type="number" step="0.01" value={costPkr} onChange={(e) => setCostPkr(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
      </label>

      <label className="block">
        <span className="smallcaps text-xs">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="block w-full rounded border border-[var(--rule)] p-1" />
      </label>

      <div>
        <span className="smallcaps text-xs">Photos</span>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={photoInput}
            onChange={(e) => setPhotoInput(e.target.value)}
            placeholder="Photo URL"
            className="flex-1 rounded border border-[var(--rule)] p-1"
          />
          <button
            type="button"
            onClick={() => {
              if (photoInput) { setPhotoUrls([...photoUrls, photoInput]); setPhotoInput(''); }
            }}
            className="rounded border border-[var(--rule)] px-2 text-xs"
          >Add</button>
        </div>
        {photoUrls.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-xs">
            {photoUrls.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className={msg === 'Logged' ? 'text-emerald-700' : 'text-red-700'}>{msg}</div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-sm text-white"
        >
          {pending ? 'Logging...' : 'Log event'}
        </button>
      </div>
    </div>
  );
}
