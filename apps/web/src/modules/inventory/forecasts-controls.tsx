'use client';
import { useTransition } from 'react';
import { recomputeForecast, toggleAutoRfq, resolveAnomaly, scanAnomaliesForInput } from './forecast-actions';

export function RecomputeButton({ inputId }: { inputId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => recomputeForecast(inputId).then(() => undefined))}
      className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-50"
    >
      {pending ? 'Recomputing...' : 'Recompute'}
    </button>
  );
}

export function AutoRfqToggle({ ruleId, initial }: { ruleId: string; initial: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        defaultChecked={initial}
        disabled={pending}
        onChange={(e) => start(() => toggleAutoRfq(ruleId, e.target.checked).then(() => undefined))}
      />
      auto-RFQ
    </label>
  );
}

export function ResolveAnomalyForm({ anomalyId }: { anomalyId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const notes = String(fd.get('notes') ?? '');
        if (!notes.trim()) return;
        start(() => resolveAnomaly({ anomalyId, notes }).then(() => undefined));
      }}
      className="flex gap-2"
    >
      <input
        name="notes"
        placeholder="Resolution notes"
        className="rounded border border-[var(--rule)] px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Resolve'}
      </button>
    </form>
  );
}

export function ScanAnomaliesButton({ inputId }: { inputId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - 30);
        const fromDate = from.toISOString().slice(0, 10);
        const toDate = today.toISOString().slice(0, 10);
        start(() => scanAnomaliesForInput({ inputId, fromDate, toDate }).then(() => undefined));
      }}
      className="rounded bg-amber-700 px-2 py-1 text-xs text-white disabled:opacity-50"
    >
      {pending ? 'Scanning...' : 'Scan 30d'}
    </button>
  );
}
