'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { Pkr } from './pkr.js';

export interface RepairQuoteRow {
  id: string;
  workshopName: string;
  totalPkr: number;
  etaDays: number | null;
  warrantyDays: number | null;
}

export type SelectionReason = 'cheapest' | 'fastest' | 'best_warranty' | 'only_available' | 'other';

export interface QuoteComparisonProps {
  quotes: RepairQuoteRow[];
  selectedId?: string;
  onSelect?: (id: string, reason: SelectionReason) => void;
  readOnly?: boolean;
  className?: string;
}

const REASONS: SelectionReason[] = ['cheapest', 'fastest', 'best_warranty', 'only_available', 'other'];

export function QuoteComparison({ quotes, selectedId, onSelect, readOnly, className }: QuoteComparisonProps) {
  const cheapest = quotes.reduce((min, q) => (q.totalPkr < min ? q.totalPkr : min), Infinity);
  return (
    <div className={cn('overflow-hidden border-t border-b border-[var(--rule)]', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
            <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Workshop</th>
            <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Total</th>
            <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Δ</th>
            <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">ETA</th>
            <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Warranty</th>
            {readOnly ? null : <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Select</th>}
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const delta = q.totalPkr - cheapest;
            const isCheapest = q.totalPkr === cheapest;
            const isSelected = q.id === selectedId;
            return (
              <tr
                key={q.id}
                className={cn(
                  'border-t border-[var(--rule)] transition-colors',
                  isSelected && 'bg-[var(--paper-2)]',
                  isCheapest && 'underline decoration-[var(--ochre)] decoration-2 underline-offset-4',
                )}
              >
                <td className="px-3 py-3 font-body">{q.workshopName}</td>
                <td className="px-3 py-3 text-right">
                  <Pkr value={q.totalPkr} />
                </td>
                <td className="px-3 py-3 text-right tabular text-[var(--ink)]/70">
                  {delta === 0 ? '—' : `+${delta.toLocaleString('en-PK')}`}
                </td>
                <td className="px-3 py-3 text-right tabular">{q.etaDays != null ? `${q.etaDays}d` : '—'}</td>
                <td className="px-3 py-3 text-right tabular">{q.warrantyDays != null ? `${q.warrantyDays}d` : '—'}</td>
                {readOnly ? null : (
                  <td className="px-3 py-3 text-right">
                    <select
                      className="border border-[var(--rule)] bg-transparent text-[0.78rem] px-2 py-1"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.currentTarget.value) onSelect?.(q.id, e.currentTarget.value as SelectionReason);
                      }}
                    >
                      <option value="">{isSelected ? 'selected' : 'select with reason'}</option>
                      {REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
