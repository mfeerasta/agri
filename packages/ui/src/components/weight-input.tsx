'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { Input } from './input.js';

export type WeightUnit = 'kg' | 'mann' | 'tonne';

const FROM_KG: Record<WeightUnit, number> = { kg: 1, mann: 1 / 40, tonne: 1 / 1000 };
const TO_KG: Record<WeightUnit, number> = { kg: 1, mann: 40, tonne: 1000 };

export interface WeightInputProps {
  valueKg: number;
  onChangeKg: (v: number) => void;
  defaultUnit?: WeightUnit;
  className?: string;
  disabled?: boolean;
}

export function WeightInput({
  valueKg,
  onChangeKg,
  defaultUnit = 'mann',
  className,
  disabled,
}: WeightInputProps) {
  const [unit, setUnit] = React.useState<WeightUnit>(defaultUnit);
  const displayed = Number((valueKg * FROM_KG[unit]).toFixed(3));
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={Number.isFinite(displayed) ? displayed : ''}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.currentTarget.value);
          onChangeKg(Number.isFinite(n) ? n * TO_KG[unit] : 0);
        }}
        className="flex-1"
      />
      <div role="tablist" className="inline-flex border border-[var(--rule)]">
        {(['kg', 'mann', 'tonne'] as WeightUnit[]).map((u) => (
          <button
            key={u}
            type="button"
            role="tab"
            aria-selected={u === unit}
            disabled={disabled}
            onClick={() => setUnit(u)}
            className={cn(
              'smallcaps px-2 py-1 text-[0.7rem] transition-colors',
              u === unit
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'bg-transparent text-[var(--ink)] hover:bg-[var(--paper-2)]',
            )}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}
