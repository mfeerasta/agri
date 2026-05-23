'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createStrategicPlan } from '../actions';

export function NewPlanForm({ defaultStartYear }: { defaultStartYear: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startYear, setStartYear] = useState(defaultStartYear);
  const [horizonYears, setHorizonYears] = useState(5);
  const [vision, setVision] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createStrategicPlan({
            name,
            startYear,
            horizonYears,
            visionStatement: vision || undefined,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push(`/strategy/${res.data.id}`);
        });
      }}
      className="space-y-4 rounded border border-slate-200 bg-white p-4"
    >
      <div>
        <label className="block text-sm font-medium">Plan name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="AGRI 5-Year Roadmap 2026-2030"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Start year</label>
          <input
            type="number"
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            min={2020}
            max={2100}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Horizon (years)</label>
          <input
            type="number"
            value={horizonYears}
            onChange={(e) => setHorizonYears(Number(e.target.value))}
            min={1}
            max={20}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Vision statement</label>
        <textarea
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Where do we want AGRI to be in 5 years?"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? 'Creating...' : 'Create plan'}
      </button>
    </form>
  );
}
