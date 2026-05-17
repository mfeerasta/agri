import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface DeltaPillProps {
  value: number | null;
  desirable?: 'high' | 'low';
  unit?: string;
  className?: string;
}

/**
 * Compact +/-N.N% chip. Colour depends on whether higher is desirable
 * (e.g. margin) or lower is desirable (e.g. cost). Renders a neutral
 * dash when `value` is null.
 */
export function DeltaPill({ value, desirable = 'high', unit = '%', className }: DeltaPillProps) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span
        className={cn(
          'tabular inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] text-[var(--fg-muted)] px-2 py-0.5 text-[0.7rem]',
          className,
        )}
      >
        — n.a.
      </span>
    );
  }
  const positive = value >= 0;
  const good = desirable === 'high' ? positive : !positive;
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem]',
        good
          ? 'bg-[var(--success)]/15 text-[var(--success)]'
          : 'bg-[var(--danger)]/15 text-[var(--danger)]',
        className,
      )}
    >
      {positive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}{unit}
    </span>
  );
}
