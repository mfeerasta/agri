'use client';
import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createVarietyTrial } from '@/modules/crops/variety-actions';

interface Props {
  varieties: { id: string; name: string; crop: string }[];
  fields: { id: string; code: string; name: string }[];
  plans: { id: string; fieldId: string; seasonLabel: string }[];
}

export function NewTrialForm({ varieties, fields, plans }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState<string>(fields[0]?.id ?? '');
  const [varietyId, setVarietyId] = useState<string>(varieties[0]?.id ?? '');
  const [season, setSeason] = useState('Rabi 2025-26');
  const [plantedOn, setPlantedOn] = useState(new Date().toISOString().slice(0, 10));
  const [areaAcres, setAreaAcres] = useState('1.0');
  const [yieldKg, setYieldKg] = useState('');
  const [quality, setQuality] = useState('');
  const [disease, setDisease] = useState('0');
  const [pest, setPest] = useState('0');
  const [netRevenue, setNetRevenue] = useState('');
  const [notes, setNotes] = useState('');

  const activePlan = useMemo(
    () => plans.find((p) => p.fieldId === fieldId)?.id,
    [plans, fieldId],
  );

  function submit() {
    setErr(null);
    startTransition(async () => {
      const res = await createVarietyTrial({
        fieldId,
        varietyId,
        season,
        plantedOn,
        cropPlanId: activePlan,
        areaAcres: Number(areaAcres),
        yieldKg: yieldKg ? Number(yieldKg) : undefined,
        qualityGrade: quality || undefined,
        diseasePressureSeverity: Number(disease),
        pestPressureSeverity: Number(pest),
        netRevenuePkr: netRevenue ? Number(netRevenue) : undefined,
        notes: notes || undefined,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      router.push('/crops/trials');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {err ? <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{err}</div> : null}

      <label className="block">
        <span className="text-sm">Field</span>
        <select className="border rounded p-2 w-full" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm">Variety</span>
        <select className="border rounded p-2 w-full" value={varietyId} onChange={(e) => setVarietyId(e.target.value)}>
          {varieties.map((v) => <option key={v.id} value={v.id}>{v.crop} · {v.name}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm">Season label</span>
          <input className="border rounded p-2 w-full" value={season} onChange={(e) => setSeason(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Planted on</span>
          <input type="date" className="border rounded p-2 w-full" value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Area (acres)</span>
          <input type="number" step="0.01" className="border rounded p-2 w-full" value={areaAcres} onChange={(e) => setAreaAcres(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Yield (kg total)</span>
          <input type="number" className="border rounded p-2 w-full" value={yieldKg} onChange={(e) => setYieldKg(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Quality grade</span>
          <input className="border rounded p-2 w-full" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="A / B / C" />
        </label>
        <label className="block">
          <span className="text-sm">Net revenue (PKR)</span>
          <input type="number" className="border rounded p-2 w-full" value={netRevenue} onChange={(e) => setNetRevenue(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Disease pressure (0-5)</span>
          <input type="number" min="0" max="5" className="border rounded p-2 w-full" value={disease} onChange={(e) => setDisease(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Pest pressure (0-5)</span>
          <input type="number" min="0" max="5" className="border rounded p-2 w-full" value={pest} onChange={(e) => setPest(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm">Notes</span>
        <textarea className="border rounded p-2 w-full" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex gap-2">
        <button disabled={pending} onClick={submit} className="px-3 py-2 border rounded bg-[var(--ink)] text-white disabled:opacity-50">
          {pending ? 'Saving...' : 'Save trial'}
        </button>
        {activePlan ? <span className="text-xs text-slate-500 self-center">Will auto-link to active crop plan on this field.</span> : null}
      </div>
    </div>
  );
}
