'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createHarvestLoss } from '@/modules/crops/variety-actions';

const LOSS_KINDS = [
  'shattering',
  'spillage',
  'rain_damage',
  'bird_damage',
  'rodent_damage',
  'storage_pest',
  'quality_downgrade',
  'rejection',
  'other',
] as const;

interface Props {
  harvests: { id: string; label: string }[];
  fields: { id: string; code: string }[];
  presetHarvestId?: string;
}

export function LossLogForm({ harvests, fields, presetHarvestId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [harvestId, setHarvestId] = useState(presetHarvestId ?? harvests[0]?.id ?? '');
  const [fieldId, setFieldId] = useState<string>('');
  const [lossKind, setLossKind] = useState<(typeof LOSS_KINDS)[number]>('shattering');
  const [estimatedKg, setEstimatedKg] = useState('0');
  const [estimatedValuePkr, setEstimatedValuePkr] = useState('');
  const [cause, setCause] = useState('');
  const [preventable, setPreventable] = useState<'yes' | 'no' | ''>('');
  const [notes, setNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');

  function addPhoto() {
    const url = photoInput.trim();
    if (!url) return;
    setPhotoUrls([...photoUrls, url]);
    setPhotoInput('');
  }

  function submit() {
    setErr(null);
    if (photoUrls.length === 0) {
      setErr('At least one photo URL is required.');
      return;
    }
    startTransition(async () => {
      const res = await createHarvestLoss({
        harvestRecordId: harvestId,
        fieldId: fieldId || undefined,
        lossKind,
        estimatedKg: Number(estimatedKg),
        estimatedValuePkr: estimatedValuePkr ? Number(estimatedValuePkr) : undefined,
        cause: cause || undefined,
        preventable: preventable === 'yes' ? true : preventable === 'no' ? false : undefined,
        notes: notes || undefined,
        photoUrls,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push('/crops/harvest-losses');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {err ? <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{err}</div> : null}

      <label className="block">
        <span className="text-sm">Harvest record</span>
        <select className="border rounded p-2 w-full" value={harvestId} onChange={(e) => setHarvestId(e.target.value)}>
          {harvests.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm">Field (optional)</span>
        <select className="border rounded p-2 w-full" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
          <option value="">—</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm">Loss kind</span>
        <select className="border rounded p-2 w-full" value={lossKind} onChange={(e) => setLossKind(e.target.value as typeof lossKind)}>
          {LOSS_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm">Estimated kg lost</span>
          <input type="number" className="border rounded p-2 w-full" value={estimatedKg} onChange={(e) => setEstimatedKg(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Estimated value (PKR)</span>
          <input type="number" className="border rounded p-2 w-full" value={estimatedValuePkr} onChange={(e) => setEstimatedValuePkr(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm">Cause</span>
        <input className="border rounded p-2 w-full" value={cause} onChange={(e) => setCause(e.target.value)} />
      </label>

      <label className="block">
        <span className="text-sm">Preventable?</span>
        <select className="border rounded p-2 w-full" value={preventable} onChange={(e) => setPreventable(e.target.value as 'yes' | 'no' | '')}>
          <option value="">unknown</option>
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm">Notes</span>
        <textarea className="border rounded p-2 w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="border rounded p-3">
        <div className="text-sm font-medium mb-2">Photo evidence ({photoUrls.length})</div>
        <div className="flex gap-2">
          <input
            className="border rounded p-2 flex-1"
            placeholder="https://..."
            value={photoInput}
            onChange={(e) => setPhotoInput(e.target.value)}
          />
          <button onClick={addPhoto} className="px-3 py-1 text-sm border rounded">Add</button>
        </div>
        <ul className="text-xs mt-2 list-disc pl-4">
          {photoUrls.map((u, i) => <li key={i}>{u}</li>)}
        </ul>
      </div>

      <button disabled={pending} onClick={submit} className="px-3 py-2 border rounded bg-[var(--ink)] text-white disabled:opacity-50">
        {pending ? 'Saving...' : 'Save loss record'}
      </button>
    </div>
  );
}
