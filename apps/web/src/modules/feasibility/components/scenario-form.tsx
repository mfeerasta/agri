'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addScenario } from '../actions';
import { COST_KEYS, computeScenario, type FeasibilityCostBreakdown } from '../calc';
import type { CropPrefill } from '../actions';

interface FieldOpt {
  id: string;
  code: string;
  acres: number;
}

interface Props {
  studyId: string;
  crops: CropPrefill[];
  fields: FieldOpt[];
  onCreated?: () => void;
}

const COST_LABELS: Record<(typeof COST_KEYS)[number], { en: string; ur: string }> = {
  seed: { en: 'Seed', ur: 'بیج' },
  fertilizer: { en: 'Fertilizer', ur: 'کھاد' },
  pesticide: { en: 'Pesticide', ur: 'دوائی' },
  irrigation: { en: 'Irrigation', ur: 'پانی' },
  labour: { en: 'Labour', ur: 'مزدوری' },
  diesel: { en: 'Diesel', ur: 'ڈیزل' },
  repair: { en: 'Repair', ur: 'مرمت' },
  other: { en: 'Other', ur: 'دیگر' },
};

export function ScenarioForm({ studyId, crops, fields, onCreated }: Props) {
  const [name, setName] = useState('');
  const [cropCode, setCropCode] = useState(crops[0]?.code ?? '');
  const [pickedFieldIds, setPickedFieldIds] = useState<string[]>([]);
  const [totalAcres, setTotalAcres] = useState(0);
  const [yieldPerAcreKg, setYieldPerAcreKg] = useState(0);
  const [pricePerKgPkr, setPricePerKgPkr] = useState(0);
  const [costs, setCosts] = useState<FeasibilityCostBreakdown>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const preview = useMemo(
    () =>
      computeScenario({
        totalAcres,
        yieldPerAcreKg,
        pricePerKgPkr,
        costBreakdown: costs,
      }),
    [totalAcres, yieldPerAcreKg, pricePerKgPkr, costs],
  );

  function applyPrefill(code: string) {
    setCropCode(code);
    const crop = crops.find((c) => c.code === code);
    if (!crop) return;
    if (crop.recommendedYieldKgPerAcre != null) setYieldPerAcreKg(crop.recommendedYieldKgPerAcre);
    if (crop.latestMandiPricePkrPerKg != null) setPricePerKgPkr(crop.latestMandiPricePkrPerKg);
    if (crop.defaultCostBreakdown) setCosts(crop.defaultCostBreakdown);
  }

  function toggleField(id: string) {
    setPickedFieldIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      const acres = fields.filter((f) => next.includes(f.id)).reduce((s, f) => s + f.acres, 0);
      setTotalAcres(Number(acres.toFixed(4)));
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addScenario({
            studyId,
            name,
            cropCode,
            fieldIds: pickedFieldIds,
            totalAcres,
            yieldPerAcreKg,
            pricePerKgPkr,
            costBreakdown: costs,
            notes: notes || undefined,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setName('');
          setNotes('');
          setPickedFieldIds([]);
          onCreated?.();
          router.refresh();
        });
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="font-medium text-sm">Add scenario / منظر نامہ</div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Scenario name (e.g. Wheat aggressive)"
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        required
      />

      <label className="block text-xs">
        <span className="text-slate-600">Crop / فصل</span>
        <select
          value={cropCode}
          onChange={(e) => applyPrefill(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {crops.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="text-xs text-slate-600 mb-1">Fields / کھیت</div>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {fields.length === 0 && <span className="text-xs text-slate-400">No fields defined.</span>}
          {fields.map((f) => {
            const on = pickedFieldIds.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleField(f.id)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  on ? 'bg-emerald-700 text-white border-emerald-700' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.code} ({f.acres.toFixed(1)})
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">
          <span className="text-slate-600">Acres</span>
          <input
            type="number"
            step="0.01"
            value={totalAcres}
            onChange={(e) => setTotalAcres(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="text-xs">
          <span className="text-slate-600">Yield kg/acre</span>
          <input
            type="number"
            step="0.01"
            value={yieldPerAcreKg}
            onChange={(e) => setYieldPerAcreKg(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
        <label className="text-xs">
          <span className="text-slate-600">Price PKR/kg</span>
          <input
            type="number"
            step="0.01"
            value={pricePerKgPkr}
            onChange={(e) => setPricePerKgPkr(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            required
          />
        </label>
      </div>

      <div>
        <div className="text-xs text-slate-600 mb-1">Cost per acre (PKR) / فی ایکڑ لاگت</div>
        <div className="grid grid-cols-2 gap-2">
          {COST_KEYS.map((k) => (
            <label key={k} className="text-xs">
              <span className="text-slate-600">
                {COST_LABELS[k].en} / <span dir="rtl">{COST_LABELS[k].ur}</span>
              </span>
              <input
                type="number"
                step="0.01"
                value={costs[k] ?? 0}
                onChange={(e) => setCosts({ ...costs, [k]: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          ))}
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />

      <div className="rounded bg-slate-50 p-2 text-xs space-y-0.5">
        <div>Revenue: PKR {preview.revenuePkr.toLocaleString()}</div>
        <div>Total cost: PKR {preview.totalCostPkr.toLocaleString()}</div>
        <div className={preview.netPkr >= 0 ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
          Net: PKR {preview.netPkr.toLocaleString()} ({preview.netPerAcrePkr.toLocaleString()}/acre)
        </div>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save scenario'}
      </button>
    </form>
  );
}
