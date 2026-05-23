'use client';

import { useMemo, useState, useTransition } from 'react';
import { upsertCropRotation } from '../actions';

const CROP_PALETTE = [
  { code: 'wheat', label: 'Wheat', color: 'bg-amber-200 text-amber-900' },
  { code: 'rice', label: 'Rice', color: 'bg-sky-200 text-sky-900' },
  { code: 'cotton', label: 'Cotton', color: 'bg-orange-200 text-orange-900' },
  { code: 'maize', label: 'Maize', color: 'bg-yellow-200 text-yellow-900' },
  { code: 'sugarcane', label: 'Sugarcane', color: 'bg-lime-200 text-lime-900' },
  { code: 'chickpea', label: 'Chickpea (legume)', color: 'bg-emerald-200 text-emerald-900' },
  { code: 'mung', label: 'Mung (legume)', color: 'bg-emerald-300 text-emerald-900' },
  { code: 'mustard', label: 'Mustard', color: 'bg-rose-200 text-rose-900' },
  { code: 'fallow', label: 'Fallow', color: 'bg-slate-200 text-slate-700' },
] as const;

const CEREALS = new Set(['wheat', 'rice', 'maize', 'sorghum', 'barley']);
const LEGUMES = new Set(['chickpea', 'mung', 'lentil', 'soybean', 'mash', 'pea', 'gram']);

interface RotationRow {
  fieldId: string;
  schedule: { year: number; cropCode: string }[];
  rotationKind: string;
}

export function RotationGridEditor({
  planId,
  startYear,
  horizonYears,
  fields,
  initial,
}: {
  planId: string;
  startYear: number;
  horizonYears: number;
  fields: { id: string; name: string; acres: number }[];
  initial: RotationRow[];
}) {
  const years = useMemo(() => Array.from({ length: horizonYears }, (_, i) => startYear + i), [startYear, horizonYears]);
  const [grid, setGrid] = useState<Record<string, Record<number, string>>>(() => {
    const init: Record<string, Record<number, string>> = {};
    for (const f of fields) {
      init[f.id] = {};
      const found = initial.find((r) => r.fieldId === f.id);
      if (found) {
        for (const e of found.schedule) init[f.id][e.year] = e.cropCode;
      }
    }
    return init;
  });
  const [dragCrop, setDragCrop] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function setCell(fieldId: string, year: number, code: string) {
    setGrid((g) => ({ ...g, [fieldId]: { ...g[fieldId], [year]: code } }));
  }
  function clearCell(fieldId: string, year: number) {
    setGrid((g) => {
      const row = { ...g[fieldId] };
      delete row[year];
      return { ...g, [fieldId]: row };
    });
  }

  function warningsFor(fieldId: string): string[] {
    const sched = years
      .map((y) => ({ year: y, cropCode: grid[fieldId]?.[y] }))
      .filter((s): s is { year: number; cropCode: string } => Boolean(s.cropCode));
    const out: string[] = [];
    for (let i = 0; i < sched.length; i++) {
      if (i >= 2 && sched[i - 1].cropCode === sched[i].cropCode && sched[i - 2].cropCode === sched[i].cropCode) {
        out.push(`${sched[i].year}: same crop 3 years in a row`);
      }
      if (i >= 1 && sched[i].cropCode === 'cotton' && sched[i - 1].cropCode === 'cotton') {
        out.push(`${sched[i].year}: cotton back-to-back`);
      }
    }
    const head = sched.slice(0, Math.min(3, sched.length));
    if (head.length >= 3 && head.every((h) => CEREALS.has(h.cropCode)) && !head.some((h) => LEGUMES.has(h.cropCode))) {
      out.push('cereal-heavy start — no legume break in first 3 years');
    }
    return out;
  }

  async function saveField(fieldId: string) {
    setMsg(null);
    const schedule = years
      .map((y) => ({ year: y, cropCode: grid[fieldId]?.[y] }))
      .filter((s): s is { year: number; cropCode: string } => Boolean(s.cropCode));
    start(async () => {
      const res = await upsertCropRotation({
        planId,
        fieldId,
        rotationSchedule: schedule,
        rotationKind: schedule.length === 2 ? 'two_year' : schedule.length === 3 ? 'three_year' : schedule.length === 4 ? 'four_year' : 'custom',
      });
      if (!res.ok) setMsg(res.error);
      else setMsg(res.warnings && res.warnings.length > 0 ? `Saved with warnings: ${res.warnings.join('; ')}` : 'Saved');
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">Drag a crop onto a cell:</div>
        {CROP_PALETTE.map((c) => (
          <div
            key={c.code}
            draggable
            onDragStart={() => setDragCrop(c.code)}
            className={`cursor-grab rounded px-2 py-1 text-xs font-medium ${c.color}`}
          >
            {c.label}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Field</th>
              {years.map((y) => (
                <th key={y} className="px-3 py-2 text-center">
                  {y}
                </th>
              ))}
              <th className="px-3 py-2">Warnings</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={years.length + 3} className="px-3 py-6 text-center text-slate-500">
                  No fields configured yet.
                </td>
              </tr>
            )}
            {fields.map((f) => {
              const warnings = warningsFor(f.id);
              return (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-slate-500">{f.acres} ac</div>
                  </td>
                  {years.map((y) => {
                    const code = grid[f.id]?.[y];
                    const palette = CROP_PALETTE.find((c) => c.code === code);
                    return (
                      <td
                        key={y}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dragCrop && setCell(f.id, y, dragCrop)}
                        onDoubleClick={() => clearCell(f.id, y)}
                        className={`px-2 py-2 text-center ${palette ? palette.color : 'bg-slate-50'} cursor-pointer`}
                        title="Drop a crop here. Double-click to clear."
                      >
                        <span className="text-xs font-medium">{code ?? ''}</span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-xs text-rose-700">
                    {warnings.length > 0 ? warnings.join(' · ') : <span className="text-emerald-600">OK</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => saveField(f.id)}
                      disabled={pending}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      Save row
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
