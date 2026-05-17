import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface AgingBarsProps {
  buckets: { current: string | number; '30d': string | number; '60d': string | number; '90dPlus': string | number };
  className?: string;
}

const SEGMENT_META: Array<{
  key: 'current' | '30d' | '60d' | '90dPlus';
  label: string;
  color: string;
}> = [
  { key: 'current', label: 'Current', color: 'var(--success)' },
  { key: '30d', label: '0-30 d', color: 'var(--accent, #6b7280)' },
  { key: '60d', label: '31-60 d', color: 'var(--warning, #d97706)' },
  { key: '90dPlus', label: '60+ d', color: 'var(--danger)' },
];

export function AgingBars({ buckets, className }: AgingBarsProps) {
  const values = SEGMENT_META.map((m) => ({ ...m, value: Number(buckets[m.key] ?? 0) }));
  const total = values.reduce((a, v) => a + v.value, 0);
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        {values.map((v) => {
          const pct = total > 0 ? (v.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={v.key}
              title={`${v.label}: ${pct.toFixed(1)}%`}
              className="h-full font-mono"
              style={{ width: `${pct}%`, backgroundColor: v.color }}
            />
          );
        })}
      </div>
      <ul className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
        {values.map((v) => (
          <li key={v.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
            <span className="text-[var(--fg-muted)]">{v.label}</span>
            <span className="tabular-nums font-medium">{v.value.toLocaleString('en-PK')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
