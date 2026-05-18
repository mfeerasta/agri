'use client';

import * as React from 'react';
import { createBonusRule } from './actions';

export function NewRuleForm({ entityId }: { entityId: string }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    try {
      const res = await createBonusRule(entityId, formData);
      setMsg(res.ok ? 'Rule created.' : res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-3 max-w-2xl">
      <div>
        <label className="smallcaps text-[0.7rem] block mb-1">Name</label>
        <input
          name="name"
          required
          className="w-full border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] text-sm"
          placeholder="Monthly top performer"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="smallcaps text-[0.7rem] block mb-1">Cadence</label>
          <select name="periodKind" defaultValue="monthly" className="w-full border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] text-sm">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="seasonal">Seasonal</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="smallcaps text-[0.7rem] block mb-1">Min score</label>
          <input
            name="minScore"
            type="number"
            step="0.1"
            defaultValue="70"
            className="w-full border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] text-sm tabular"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="smallcaps text-[0.7rem] block mb-1">Amount kind</label>
          <select name="amountKind" defaultValue="flat" className="w-full border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] text-sm">
            <option value="flat">Flat Rs.</option>
            <option value="percent_of_base">% of base</option>
            <option value="percent_of_piece_rate">% of piece-rate</option>
            <option value="top_n">Top N flat</option>
          </select>
        </div>
        <div>
          <label className="smallcaps text-[0.7rem] block mb-1">Amount value</label>
          <input
            name="amountValue"
            type="number"
            step="0.01"
            required
            defaultValue="2000"
            className="w-full border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] text-sm tabular"
          />
        </div>
        <div>
          <label className="smallcaps text-[0.7rem] block mb-1">Top N (if applicable)</label>
          <input
            name="topN"
            type="number"
            min="1"
            placeholder="3"
            className="w-full border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] text-sm tabular"
          />
        </div>
      </div>
      <div>
        <label className="smallcaps text-[0.7rem] block mb-1">Formula filters (optional)</label>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <input name="minDaysPresent" type="number" placeholder="min days present" className="border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] tabular" />
          <input name="maxDaysLate" type="number" placeholder="max days late" className="border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] tabular" />
          <input name="maxTasksLate" type="number" placeholder="max tasks late" className="border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] tabular" />
          <input name="maxDieselAnomalies" type="number" placeholder="max anomalies" className="border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] tabular" />
          <input name="minTasksCompleted" type="number" placeholder="min tasks done" className="border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] tabular" />
          <input name="minPieceRateUnits" type="number" placeholder="min piece units" className="border border-[var(--rule)] px-2 py-1 bg-[var(--paper)] tabular" />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
      >
        {busy ? 'Saving...' : 'Create rule'}
      </button>
      {msg ? <div className="text-xs text-[var(--ink)]/70">{msg}</div> : null}
    </form>
  );
}
