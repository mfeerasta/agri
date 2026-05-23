'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { proposeInitiative } from '../actions';

const CATEGORIES = [
  'crop_rotation',
  'capex',
  'expansion',
  'diversification',
  'technology',
  'sustainability',
  'market_development',
  'workforce',
  'financial',
  'other',
] as const;

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export function NewInitiativeForm({
  planId,
  baseYear,
  horizonYears,
}: {
  planId: string;
  baseYear: number;
  horizonYears: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('capex');
  const [startYear, setStartYear] = useState(baseYear);
  const [endYear, setEndYear] = useState(baseYear + 1);
  const [investment, setInvestment] = useState(0);
  const [expectedReturn, setExpectedReturn] = useState(0);
  const [irrPct, setIrrPct] = useState<number | ''>('');
  const [paybackYears, setPaybackYears] = useState<number | ''>('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [notes, setNotes] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await proposeInitiative({
            planId,
            name,
            category,
            startYear,
            endYear,
            estimatedInvestmentPkr: investment || undefined,
            expectedReturnPkr: expectedReturn || undefined,
            expectedIrrPct: irrPct === '' ? undefined : Number(irrPct),
            paybackYears: paybackYears === '' ? undefined : Number(paybackYears),
            priority,
            notes: notes || undefined,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push(`/strategy/${planId}`);
        });
      }}
      className="space-y-4 rounded border border-slate-200 bg-white p-4"
    >
      <Row label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inp} placeholder="Solar panel install" />
      </Row>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Row label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])} className={inp}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])} className={inp}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Start year">
          <input
            type="number"
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            min={baseYear}
            max={baseYear + horizonYears - 1}
            className={inp}
          />
        </Row>
        <Row label="End year">
          <input
            type="number"
            value={endYear}
            onChange={(e) => setEndYear(Number(e.target.value))}
            min={baseYear}
            max={baseYear + horizonYears - 1}
            className={inp}
          />
        </Row>
        <Row label="Estimated investment (PKR)">
          <input type="number" value={investment} onChange={(e) => setInvestment(Number(e.target.value))} className={inp} />
        </Row>
        <Row label="Expected return (PKR)">
          <input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} className={inp} />
        </Row>
        <Row label="Expected IRR %">
          <input
            type="number"
            value={irrPct}
            onChange={(e) => setIrrPct(e.target.value === '' ? '' : Number(e.target.value))}
            className={inp}
          />
        </Row>
        <Row label="Payback (years)">
          <input
            type="number"
            value={paybackYears}
            onChange={(e) => setPaybackYears(e.target.value === '' ? '' : Number(e.target.value))}
            className={inp}
          />
        </Row>
      </div>
      <Row label="Notes / risk factors">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inp} />
      </Row>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? 'Submitting...' : 'Submit for Director approval'}
      </button>
    </form>
  );
}

const inp = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm';
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
