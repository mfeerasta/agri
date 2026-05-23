'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRecipe } from '@/modules/processing/actions';
import type { ProcessKind } from '@zameen/db';

const PROCESS_KINDS: ProcessKind[] = [
  'wheat_milling',
  'rice_milling',
  'dairy_processing',
  'oil_extraction',
  'cotton_ginning',
  'sugar_processing',
  'gur_making',
  'fodder_processing',
  'seed_cleaning',
  'feed_mixing',
  'packaging',
  'other',
];

export function NewRecipeForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProcessKind>('wheat_milling');
  const [inputCrop, setInputCrop] = useState('wheat');
  const [inputKg, setInputKg] = useState(1000);
  const [outputName, setOutputName] = useState('atta');
  const [outputKg, setOutputKg] = useState(720);
  const [yieldPct, setYieldPct] = useState(97);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await createRecipe({
      name,
      processKind: kind,
      inputs: [{ crop: inputCrop, quantityKg: inputKg, grade: 'a' }],
      outputs: [{ name: outputName, quantityKg: outputKg, grade: 'a' }],
      expectedTotalYieldPct: yieldPct,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setName('');
    router.refresh();
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
      <h2 className="font-semibold">New recipe (quick)</h2>
      <p className="text-xs text-slate-500">
        For complex multi-output recipes, use the API directly. This form covers single-output BOMs.
      </p>
      <label className="block text-sm">
        Name
        <input
          className="mt-1 w-full rounded border px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Process
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          value={kind}
          onChange={(e) => setKind(e.target.value as ProcessKind)}
        >
          {PROCESS_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>
          Input crop
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={inputCrop}
            onChange={(e) => setInputCrop(e.target.value)}
          />
        </label>
        <label>
          Input kg
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1"
            value={inputKg}
            onChange={(e) => setInputKg(Number(e.target.value))}
          />
        </label>
        <label>
          Output name
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
          />
        </label>
        <label>
          Output kg
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1"
            value={outputKg}
            onChange={(e) => setOutputKg(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="block text-sm">
        Expected yield %
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1"
          value={yieldPct}
          onChange={(e) => setYieldPct(Number(e.target.value))}
        />
      </label>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={submit}
        className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? 'Saving...' : 'Create recipe'}
      </button>
    </div>
  );
}
