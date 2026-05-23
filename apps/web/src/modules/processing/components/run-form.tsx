'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordRun } from '@/modules/processing/actions';

interface RecipeLike {
  id: string;
  name: string;
  inputs: { crop: string; quantityKg: number }[];
  outputs: { name: string; quantityKg: number }[];
  byproducts: { kind: string; quantityKg: number }[] | null;
  expectedTotalYieldPct: string | null;
}

interface RowInput {
  crop: string;
  quantityKg: number;
  unitCostPkr: number;
}
interface RowOutput {
  name: string;
  quantityKg: number;
  grade: 'a' | 'b' | 'c';
}
interface RowByp {
  kind: string;
  quantityKg: number;
  unitValuePkr: number;
}

export function RunForm({
  recipes,
  preselectRecipeId,
}: {
  recipes: RecipeLike[];
  preselectRecipeId: string | null;
}) {
  const router = useRouter();
  const [recipeId, setRecipeId] = useState<string>(preselectRecipeId ?? recipes[0]?.id ?? '');
  const recipe = useMemo(() => recipes.find((r) => r.id === recipeId), [recipeId, recipes]);

  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endedAt, setEndedAt] = useState('');
  const [inputs, setInputs] = useState<RowInput[]>(
    () => recipe?.inputs.map((i) => ({ crop: i.crop, quantityKg: i.quantityKg, unitCostPkr: 0 })) ?? [],
  );
  const [outputs, setOutputs] = useState<RowOutput[]>(
    () => recipe?.outputs.map((o) => ({ name: o.name, quantityKg: o.quantityKg, grade: 'a' as const })) ?? [],
  );
  const [byproducts, setByproducts] = useState<RowByp[]>(
    () => recipe?.byproducts?.map((b) => ({ kind: b.kind, quantityKg: b.quantityKg, unitValuePkr: 0 })) ?? [],
  );
  const [energyKwh, setEnergyKwh] = useState(0);
  const [energyRate, setEnergyRate] = useState(45);
  const [labourMinutes, setLabourMinutes] = useState(0);
  const [labourRate, setLabourRate] = useState(120);
  const [overheadPkr, setOverheadPkr] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onRecipeChange(id: string) {
    setRecipeId(id);
    const r = recipes.find((x) => x.id === id);
    setInputs(r?.inputs.map((i) => ({ crop: i.crop, quantityKg: i.quantityKg, unitCostPkr: 0 })) ?? []);
    setOutputs(r?.outputs.map((o) => ({ name: o.name, quantityKg: o.quantityKg, grade: 'a' as const })) ?? []);
    setByproducts(r?.byproducts?.map((b) => ({ kind: b.kind, quantityKg: b.quantityKg, unitValuePkr: 0 })) ?? []);
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await recordRun({
      recipeId,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: endedAt ? new Date(endedAt).toISOString() : undefined,
      inputs: inputs.map((i) => ({ crop: i.crop, quantityKg: i.quantityKg, unitCostPkr: i.unitCostPkr })),
      outputs: outputs.map((o) => ({ name: o.name, quantityKg: o.quantityKg, grade: o.grade })),
      byproducts: byproducts
        .filter((b) => b.quantityKg > 0)
        .map((b) => ({ kind: b.kind, quantityKg: b.quantityKg, unitValuePkr: b.unitValuePkr })),
      energyKwh,
      energyRatePkrPerKwh: energyRate,
      labourMinutes,
      labourRatePkrPerHour: labourRate,
      overheadPkr,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    router.push(`/processing/runs/${r.data.runId}`);
  }

  if (recipes.length === 0) {
    return <p className="text-sm text-slate-500">No recipes available. Create one first.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Run setup</h2>
        <label className="block text-sm">
          Recipe
          <select
            className="mt-1 w-full rounded border px-2 py-1"
            value={recipeId}
            onChange={(e) => onRecipeChange(e.target.value)}
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            Started
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-2 py-1"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </label>
          <label>
            Ended
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-2 py-1"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
            />
          </label>
        </div>

        <div className="text-sm font-medium">Inputs (actual)</div>
        {inputs.map((row, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2 text-sm">
            <input
              className="rounded border px-2 py-1"
              value={row.crop}
              onChange={(e) => {
                const next = [...inputs];
                next[idx] = { ...row, crop: e.target.value };
                setInputs(next);
              }}
            />
            <input
              type="number"
              className="rounded border px-2 py-1"
              value={row.quantityKg}
              onChange={(e) => {
                const next = [...inputs];
                next[idx] = { ...row, quantityKg: Number(e.target.value) };
                setInputs(next);
              }}
            />
            <input
              type="number"
              placeholder="PKR/kg"
              className="rounded border px-2 py-1"
              value={row.unitCostPkr}
              onChange={(e) => {
                const next = [...inputs];
                next[idx] = { ...row, unitCostPkr: Number(e.target.value) };
                setInputs(next);
              }}
            />
          </div>
        ))}

        <div className="text-sm font-medium">Outputs (actual)</div>
        {outputs.map((row, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2 text-sm">
            <input
              className="rounded border px-2 py-1"
              value={row.name}
              onChange={(e) => {
                const next = [...outputs];
                next[idx] = { ...row, name: e.target.value };
                setOutputs(next);
              }}
            />
            <input
              type="number"
              className="rounded border px-2 py-1"
              value={row.quantityKg}
              onChange={(e) => {
                const next = [...outputs];
                next[idx] = { ...row, quantityKg: Number(e.target.value) };
                setOutputs(next);
              }}
            />
            <select
              className="rounded border px-2 py-1"
              value={row.grade}
              onChange={(e) => {
                const next = [...outputs];
                next[idx] = { ...row, grade: e.target.value as 'a' | 'b' | 'c' };
                setOutputs(next);
              }}
            >
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="c">C</option>
            </select>
          </div>
        ))}
      </div>

      <div className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Costs + byproducts</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            Energy kWh
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={energyKwh}
              onChange={(e) => setEnergyKwh(Number(e.target.value))}
            />
          </label>
          <label>
            PKR per kWh
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={energyRate}
              onChange={(e) => setEnergyRate(Number(e.target.value))}
            />
          </label>
          <label>
            Labour minutes
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={labourMinutes}
              onChange={(e) => setLabourMinutes(Number(e.target.value))}
            />
          </label>
          <label>
            PKR per hour
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={labourRate}
              onChange={(e) => setLabourRate(Number(e.target.value))}
            />
          </label>
          <label className="col-span-2">
            Overhead PKR
            <input
              type="number"
              className="mt-1 w-full rounded border px-2 py-1"
              value={overheadPkr}
              onChange={(e) => setOverheadPkr(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="text-sm font-medium">Byproducts</div>
        {byproducts.length === 0 && <p className="text-xs text-slate-500">No byproducts on this recipe.</p>}
        {byproducts.map((row, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2 text-sm">
            <input
              className="rounded border px-2 py-1"
              value={row.kind}
              onChange={(e) => {
                const next = [...byproducts];
                next[idx] = { ...row, kind: e.target.value };
                setByproducts(next);
              }}
            />
            <input
              type="number"
              className="rounded border px-2 py-1"
              value={row.quantityKg}
              onChange={(e) => {
                const next = [...byproducts];
                next[idx] = { ...row, quantityKg: Number(e.target.value) };
                setByproducts(next);
              }}
            />
            <input
              type="number"
              placeholder="PKR/kg credit"
              className="rounded border px-2 py-1"
              value={row.unitValuePkr}
              onChange={(e) => {
                const next = [...byproducts];
                next[idx] = { ...row, unitValuePkr: Number(e.target.value) };
                setByproducts(next);
              }}
            />
          </div>
        ))}

        <label className="block text-sm">
          Notes
          <textarea
            className="mt-1 w-full rounded border px-2 py-1"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button
          type="button"
          disabled={busy || !recipeId}
          onClick={submit}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Posting...' : 'Post run'}
        </button>
      </div>
    </div>
  );
}
