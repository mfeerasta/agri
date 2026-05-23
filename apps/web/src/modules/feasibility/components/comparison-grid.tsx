'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteScenario, duplicateScenario } from '../actions';
import { applySensitivity, computeScenario, COST_KEYS } from '../calc';

export interface ScenarioRow {
  id: string;
  name: string;
  cropCode: string;
  fieldIds: string[];
  totalAcres: number;
  yieldPerAcreKg: number;
  pricePerKgPkr: number;
  costBreakdown: Record<string, number>;
  revenuePkr: number;
  totalCostPkr: number;
  netPkr: number;
  netPerAcrePkr: number;
  irrPct: number | null;
  paybackMonths: number | null;
  notes: string | null;
}

interface Props {
  scenarios: ScenarioRow[];
}

function pkr(n: number) {
  return `PKR ${Math.round(n).toLocaleString()}`;
}

function pct(n: number, ref: number) {
  if (!ref) return '';
  const d = ((n - ref) / Math.abs(ref)) * 100;
  if (!isFinite(d)) return '';
  const sign = d >= 0 ? '+' : '';
  return ` (${sign}${d.toFixed(1)}%)`;
}

export function ComparisonGrid({ scenarios }: Props) {
  const [yieldDelta, setYieldDelta] = useState(0);
  const [priceDelta, setPriceDelta] = useState(0);
  const [, start] = useTransition();
  const router = useRouter();

  const computed = useMemo(
    () =>
      scenarios.map((s) => {
        const c = computeScenario(
          applySensitivity(
            {
              totalAcres: s.totalAcres,
              yieldPerAcreKg: s.yieldPerAcreKg,
              pricePerKgPkr: s.pricePerKgPkr,
              costBreakdown: s.costBreakdown,
            },
            yieldDelta,
            priceDelta,
          ),
        );
        return { row: s, c };
      }),
    [scenarios, yieldDelta, priceDelta],
  );

  if (scenarios.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No scenarios yet. Use the form to add one.
      </div>
    );
  }

  const base = computed[0]!.c;

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="text-xs font-medium text-slate-600 mb-2">Sensitivity</div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-xs">
            <div className="flex justify-between">
              <span>Yield</span>
              <span className={yieldDelta < 0 ? 'text-red-600' : 'text-emerald-700'}>
                {yieldDelta >= 0 ? '+' : ''}
                {yieldDelta}%
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={yieldDelta}
              onChange={(e) => setYieldDelta(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="text-xs">
            <div className="flex justify-between">
              <span>Price</span>
              <span className={priceDelta < 0 ? 'text-red-600' : 'text-emerald-700'}>
                {priceDelta >= 0 ? '+' : ''}
                {priceDelta}%
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={priceDelta}
              onChange={(e) => setPriceDelta(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b border-slate-200 sticky left-0 bg-white">Metric</th>
              {computed.map(({ row }, i) => (
                <th key={row.id} className="text-left p-2 border-b border-slate-200 min-w-[180px]">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {row.name}
                      {i === 0 && <span className="ml-1 text-[10px] text-slate-400">(base)</span>}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          start(async () => {
                            await duplicateScenario(row.id);
                            router.refresh();
                          })
                        }
                        title="Duplicate"
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        copy
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          start(async () => {
                            if (!confirm(`Delete scenario ${row.name}?`)) return;
                            await deleteScenario(row.id);
                            router.refresh();
                          })
                        }
                        title="Delete"
                        className="text-xs text-red-500 hover:text-red-800"
                      >
                        del
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Crop" cells={computed.map(({ row }) => row.cropCode)} />
            <Row label="Fields" cells={computed.map(({ row }) => row.fieldIds.length.toString())} />
            <Row label="Acres" cells={computed.map(({ row }) => row.totalAcres.toFixed(2))} />
            <Row
              label="Yield kg/acre"
              cells={computed.map(({ row }) => (row.yieldPerAcreKg * (1 + yieldDelta / 100)).toFixed(0))}
            />
            <Row
              label="Price PKR/kg"
              cells={computed.map(({ row }) => (row.pricePerKgPkr * (1 + priceDelta / 100)).toFixed(2))}
            />
            <Row label="Yield total kg" cells={computed.map(({ c }) => c.yieldKgTotal.toLocaleString())} />
            <Row
              label="Revenue"
              cells={computed.map(({ c }, i) => pkr(c.revenuePkr) + (i > 0 ? pct(c.revenuePkr, base.revenuePkr) : ''))}
            />
            {COST_KEYS.map((k) => (
              <Row
                key={k}
                label={`Cost ${k}/acre`}
                cells={computed.map(({ row }) => pkr(row.costBreakdown[k] ?? 0))}
                muted
              />
            ))}
            <Row
              label="Total cost"
              cells={computed.map(({ c }, i) => pkr(c.totalCostPkr) + (i > 0 ? pct(c.totalCostPkr, base.totalCostPkr) : ''))}
            />
            <Row
              label="Net PKR"
              cells={computed.map(({ c }, i) => pkr(c.netPkr) + (i > 0 ? pct(c.netPkr, base.netPkr) : ''))}
              emphasize
            />
            <Row
              label="Net / acre"
              cells={computed.map(({ c }, i) => pkr(c.netPerAcrePkr) + (i > 0 ? pct(c.netPerAcrePkr, base.netPerAcrePkr) : ''))}
              emphasize
            />
            <Row
              label="IRR % (annualised)"
              cells={computed.map(({ c }) => (c.irrPct != null ? `${c.irrPct.toFixed(1)}%` : '-'))}
            />
            <Row
              label="Payback (months)"
              cells={computed.map(({ c }) => (c.paybackMonths != null ? c.paybackMonths.toFixed(1) : '-'))}
            />
            <Row label="Notes" cells={computed.map(({ row }) => row.notes ?? '')} muted />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  cells,
  emphasize,
  muted,
}: {
  label: string;
  cells: string[];
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className={emphasize ? 'bg-emerald-50' : muted ? 'text-slate-500' : ''}>
      <td className="p-2 border-b border-slate-100 sticky left-0 bg-inherit font-medium">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="p-2 border-b border-slate-100">
          {c}
        </td>
      ))}
    </tr>
  );
}
