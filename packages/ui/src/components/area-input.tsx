'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { Input } from './input.js';

export type AreaUnit = 'acre' | 'kanal' | 'marla';

const TO_ACRE: Record<AreaUnit, number> = {
  acre: 1,
  kanal: 1 / 8,
  marla: 1 / 160,
};

const FROM_ACRE: Record<AreaUnit, number> = {
  acre: 1,
  kanal: 8,
  marla: 160,
};

export interface AreaInputProps {
  valueAcres: number;
  onChangeAcres: (v: number) => void;
  defaultUnit?: AreaUnit;
  className?: string;
  disabled?: boolean;
}

export function AreaInput({
  valueAcres,
  onChangeAcres,
  defaultUnit = 'acre',
  className,
  disabled,
}: AreaInputProps) {
  const [unit, setUnit] = React.useState<AreaUnit>(defaultUnit);
  const displayed = Number((valueAcres * FROM_ACRE[unit]).toFixed(3));
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
          onChangeAcres(Number.isFinite(n) ? n * TO_ACRE[unit] : 0);
        }}
        className="flex-1"
      />
      <div role="tablist" className="inline-flex border border-[var(--rule)]">
        {(['acre', 'kanal', 'marla'] as AreaUnit[]).map((u) => (
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
