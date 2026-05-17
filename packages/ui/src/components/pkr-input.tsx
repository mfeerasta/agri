'use client';
import * as React from 'react';
import { Mic } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { Input } from './input.js';

export interface PkrInputProps {
  /** Stored as paisa (bigint) to avoid float drift. */
  value: bigint;
  onChange: (paisa: bigint) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  showVoice?: boolean;
}

function paisaToDisplay(p: bigint): string {
  const negative = p < 0n;
  const abs = negative ? -p : p;
  const rupees = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${rupees.toString()}.${frac}`;
}

function parseToPaisa(s: string): bigint {
  const cleaned = s.replace(/[, ]/g, '').replace(/[^0-9.\-]/g, '');
  if (!cleaned) return 0n;
  const [whole, fracRaw = ''] = cleaned.split('.');
  const frac = (fracRaw + '00').slice(0, 2);
  const sign = whole?.startsWith('-') ? -1n : 1n;
  const w = (whole ?? '0').replace('-', '');
  return sign * (BigInt(w || '0') * 100n + BigInt(frac));
}

export function PkrInput({ value, onChange, disabled, className, placeholder, showVoice = true }: PkrInputProps) {
  const [mode, setMode] = React.useState<'plain' | 'lac_crore'>('plain');
  const display = paisaToDisplay(value);
  const lacCroreLabel = (() => {
    const rupees = Number(value) / 100;
    const abs = Math.abs(rupees);
    if (abs >= 10_000_000) return `${(rupees / 10_000_000).toFixed(2)} crore`;
    if (abs >= 100_000) return `${(rupees / 100_000).toFixed(2)} lac`;
    return null;
  })();
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <div className="flex items-baseline gap-1 flex-1">
        <span className="smallcaps text-[var(--ochre)] pb-2">Rs.</span>
        <Input
          inputMode="decimal"
          disabled={disabled}
          placeholder={placeholder ?? '0.00'}
          value={display === '0.00' && value === 0n ? '' : display}
          onChange={(e) => onChange(parseToPaisa(e.currentTarget.value))}
          className="flex-1"
        />
      </div>
      {lacCroreLabel ? (
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'plain' ? 'lac_crore' : 'plain'))}
          className="smallcaps border border-[var(--rule)] px-2 py-1 text-[0.65rem]"
        >
          {mode === 'plain' ? lacCroreLabel : 'show full'}
        </button>
      ) : null}
      {showVoice ? (
        <button
          type="button"
          className="border border-[var(--rule)] p-2 text-[var(--ink)] hover:bg-[var(--paper-2)]"
          onClick={() => {
            // Voice integration handled by VoiceInput in form context.
          }}
          aria-label="Voice"
        >
          <Mic size={16} strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  );
}
