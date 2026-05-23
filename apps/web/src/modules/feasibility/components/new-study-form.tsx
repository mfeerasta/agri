'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createStudy } from '../actions';

export function NewStudyForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        New study
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createStudy({ entityId: '', name, season: season || undefined });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push(`/app/crops/feasibility/${res.data.id}`);
        });
      }}
      className="flex flex-col gap-2 rounded border border-slate-200 bg-white p-3 w-80"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Study name (e.g. Rabi 2026 plan)"
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        required
      />
      <input
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        placeholder="Season label (optional)"
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}
