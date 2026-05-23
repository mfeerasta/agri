'use client';
import { useState, useTransition } from 'react';
import { upsertReorderRule } from './forecast-actions';

export function ReorderRuleForm({ inputs }: { inputs: Array<{ id: string; name: string; unit: string }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const ruleKind = String(fd.get('ruleKind') ?? 'reorder_point') as
          | 'reorder_point'
          | 'periodic'
          | 'eoq'
          | 'manual';
        const inputId = String(fd.get('inputId') ?? '');
        if (!inputId) {
          setError('Pick an input');
          return;
        }
        const args = {
          inputId,
          ruleKind,
          reorderPoint: fd.get('reorderPoint') ? Number(fd.get('reorderPoint')) : undefined,
          reorderQuantity: fd.get('reorderQuantity') ? Number(fd.get('reorderQuantity')) : undefined,
          reviewPeriodDays: fd.get('reviewPeriodDays') ? Number(fd.get('reviewPeriodDays')) : undefined,
          safetyStockDays: Number(fd.get('safetyStockDays') ?? 7),
          autoCreateRfq: fd.get('autoCreateRfq') === 'on',
          isActive: true,
        };
        start(async () => {
          const res = await upsertReorderRule(args);
          if (!res.ok) setError(res.error);
          else (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <label className="text-xs">
        Input
        <select name="inputId" className="mt-1 w-full rounded border border-[var(--rule)] px-2 py-1 text-sm">
          <option value="">Select...</option>
          {inputs.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Rule kind
        <select name="ruleKind" className="mt-1 w-full rounded border border-[var(--rule)] px-2 py-1 text-sm">
          <option value="reorder_point">Reorder point</option>
          <option value="eoq">EOQ</option>
          <option value="periodic">Periodic review</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <label className="text-xs">
        Reorder point
        <input
          name="reorderPoint"
          type="number"
          step="0.01"
          className="mt-1 w-full rounded border border-[var(--rule)] px-2 py-1 text-sm tabular"
        />
      </label>
      <label className="text-xs">
        Reorder quantity (blank = use EOQ)
        <input
          name="reorderQuantity"
          type="number"
          step="0.01"
          className="mt-1 w-full rounded border border-[var(--rule)] px-2 py-1 text-sm tabular"
        />
      </label>
      <label className="text-xs">
        Review period (days)
        <input
          name="reviewPeriodDays"
          type="number"
          className="mt-1 w-full rounded border border-[var(--rule)] px-2 py-1 text-sm tabular"
        />
      </label>
      <label className="text-xs">
        Safety stock (days)
        <input
          name="safetyStockDays"
          type="number"
          defaultValue={7}
          className="mt-1 w-full rounded border border-[var(--rule)] px-2 py-1 text-sm tabular"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-xs">
        <input name="autoCreateRfq" type="checkbox" /> Auto-create RFQ when below reorder point
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        {error ? <p className="mb-2 text-xs text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Create rule'}
        </button>
      </div>
    </form>
  );
}
