'use client';
import { useState, useTransition } from 'react';
import { createPool } from '../actions';

const KINDS = [
  'input_seed',
  'input_fertilizer',
  'input_pesticide',
  'equipment_rental',
  'service',
  'other',
] as const;

export function PoolForm({ cooperatives }: { cooperatives: Array<{ id: string; name: string }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await createPool({
            cooperativeId: String(fd.get('cooperativeId')),
            itemName: String(fd.get('itemName')),
            itemKind: fd.get('itemKind') as (typeof KINDS)[number],
            targetTotalQuantity: Number(fd.get('targetTotalQuantity')),
            unit: String(fd.get('unit')),
            estimatedPerUnitPkr: Number(fd.get('estimatedPerUnitPkr')) || undefined,
            estimatedSavingsPct: Number(fd.get('estimatedSavingsPct')) || undefined,
            closesOn: String(fd.get('closesOn') ?? '') || undefined,
          });
          setMsg(res.ok ? 'Pool opened' : res.error);
          if (res.ok) (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <label className="text-xs">
        Cooperative
        <select name="cooperativeId" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm">
          {cooperatives.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Item
        <input name="itemName" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Kind
        <select name="itemKind" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Target quantity
        <input name="targetTotalQuantity" type="number" step="0.0001" required className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Unit
        <input name="unit" required placeholder="bag, kg, hr" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Est. per unit (PKR)
        <input name="estimatedPerUnitPkr" type="number" step="0.01" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Est. savings %
        <input name="estimatedSavingsPct" type="number" step="0.01" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <label className="text-xs">
        Closes on
        <input name="closesOn" type="date" className="mt-1 w-full rounded-sm bg-[var(--paper-2)] p-2 text-sm" />
      </label>
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]"
        >
          {pending ? 'Opening' : 'Open pool'}
        </button>
        {msg && <span className="text-xs text-[var(--zameen-700)]">{msg}</span>}
      </div>
    </form>
  );
}
