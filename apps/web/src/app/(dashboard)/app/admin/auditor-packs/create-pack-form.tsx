'use client';

import * as React from 'react';
import { createAuditorPack } from './actions';

export function CreatePackForm() {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createAuditorPack({
          periodStart: String(formData.get('periodStart')),
          periodEnd: String(formData.get('periodEnd')),
          scope: String(formData.get('scope')) as 'full' | 'financial_only' | 'operational_only' | 'specific_modules',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create pack');
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3 border border-[var(--rule)] rounded-[10px] p-4">
      <label className="flex flex-col gap-1 text-[0.7rem] smallcaps">
        Period start
        <input
          type="date"
          name="periodStart"
          required
          className="border border-[var(--rule)] rounded px-2 py-1 text-sm tabular"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.7rem] smallcaps">
        Period end
        <input
          type="date"
          name="periodEnd"
          required
          className="border border-[var(--rule)] rounded px-2 py-1 text-sm tabular"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.7rem] smallcaps">
        Scope
        <select name="scope" className="border border-[var(--rule)] rounded px-2 py-1 text-sm">
          <option value="full">Full</option>
          <option value="financial_only">Financial only</option>
          <option value="operational_only">Operational only</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[10px] bg-[var(--accent)] text-[var(--paper)] px-4 py-2 text-sm smallcaps disabled:opacity-50"
      >
        {pending ? 'Building…' : 'Create pack'}
      </button>
      {error ? <span className="text-[var(--danger)] text-xs">{error}</span> : null}
    </form>
  );
}
