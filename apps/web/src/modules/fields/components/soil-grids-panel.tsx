import * as React from 'react';
import type { SoilGridsResult } from '@zameen/shared';

interface Props {
  data: SoilGridsResult | null;
  fetchedAt: Date | string | null;
}

function HeatBar({
  label,
  values,
  min,
  max,
  unit,
}: {
  label: string;
  values: number[];
  min: number;
  max: number;
  unit: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-[var(--fg-muted)]">{label}</span>
      <div className="flex flex-1 gap-1">
        {values.map((v, i) => {
          const pct = Math.max(0, Math.min(1, (v - min) / Math.max(0.0001, max - min)));
          const bg = `hsl(${Math.round(40 + pct * 80)}, 70%, ${Math.round(80 - pct * 40)}%)`;
          return (
            <div
              key={i}
              className="flex-1 rounded px-1 py-0.5 text-center text-[10px] text-slate-900"
              style={{ backgroundColor: bg }}
              title={`${['0-5cm', '5-15cm', '15-30cm'][i]}: ${v.toFixed(2)} ${unit}`}
            >
              {Number.isFinite(v) ? v.toFixed(1) : 'n/a'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SoilGridsPanel({ data, fetchedAt }: Props): React.ReactElement | null {
  if (!data) return null;
  return (
    <div className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Soil baseline (SoilGrids)</h3>
        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
          {data.classification}
        </span>
      </div>
      <div className="space-y-1.5">
        <HeatBar label="pH" values={[data.ph['0-5cm'], data.ph['5-15cm'], data.ph['15-30cm']]} min={5} max={9} unit="pH" />
        <HeatBar
          label="Organic C"
          values={[
            data.organicCarbonGPerKg['0-5cm'],
            data.organicCarbonGPerKg['5-15cm'],
            data.organicCarbonGPerKg['15-30cm'],
          ]}
          min={2}
          max={30}
          unit="g/kg"
        />
        <HeatBar
          label="Clay %"
          values={[data.clayPct['0-5cm'], data.clayPct['5-15cm'], data.clayPct['15-30cm']]}
          min={5}
          max={60}
          unit="%"
        />
        <HeatBar
          label="Sand %"
          values={[data.sandPct['0-5cm'], data.sandPct['5-15cm'], data.sandPct['15-30cm']]}
          min={5}
          max={90}
          unit="%"
        />
        <HeatBar
          label="Silt %"
          values={[data.siltPct['0-5cm'], data.siltPct['5-15cm'], data.siltPct['15-30cm']]}
          min={5}
          max={80}
          unit="%"
        />
      </div>
      <p className="text-[11px] text-[var(--fg-muted)]">
        Soil profile is from SoilGrids 250m global model. Confirm with a lab test before fertiliser
        decisions. {fetchedAt ? `Last refreshed ${new Date(fetchedAt).toLocaleDateString()}.` : ''}
      </p>
    </div>
  );
}
