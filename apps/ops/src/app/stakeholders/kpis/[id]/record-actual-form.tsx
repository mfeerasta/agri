'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordKpiActual } from '../../actions';

export function RecordActualForm({ kpiId, unit }: { kpiId: string; unit: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(monthAgo);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [value, setValue] = useState('');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const v = Number(value);
    if (!Number.isFinite(v)) {
      setError('Value must be a number');
      return;
    }
    start(async () => {
      const res = await recordKpiActual({
        kpiId,
        periodStart,
        periodEnd,
        value: v,
        targetValue: target ? Number(target) : undefined,
        notes: notes || undefined,
      });
      if (res.ok) {
        setValue('');
        setNotes('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm">Period start</span>
          <input type="date" className="block w-full border rounded p-2" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Period end</span>
          <input type="date" className="block w-full border rounded p-2" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">Value ({unit})</span>
        <input type="number" step="any" className="block w-full border rounded p-2" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm">Target (optional)</span>
        <input type="number" step="any" className="block w-full border rounded p-2" value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm">Notes</span>
        <input className="block w-full border rounded p-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <button type="button" onClick={submit} disabled={pending} className="px-4 py-2 rounded bg-emerald-700 text-white disabled:opacity-50">
        {pending ? 'Saving…' : 'Save actual'}
      </button>
    </div>
  );
}
