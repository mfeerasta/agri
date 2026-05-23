'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateReport } from '../../actions';

interface Props {
  stakeholders: Array<{ id: string; name: string; kind: string }>;
  initialStakeholderId?: string;
}

export function GenerateReportForm({ stakeholders, initialStakeholderId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stakeholderId, setStakeholderId] = useState(initialStakeholderId ?? stakeholders[0]?.id ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const aMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(aMonthAgo);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await generateReport({ stakeholderId, periodStart, periodEnd, dueDate, coverLetter });
      if (res.ok) {
        router.push(`/stakeholders/${stakeholderId}`);
      } else {
        setError(res.error);
      }
    });
  }

  if (stakeholders.length === 0) {
    return <div className="text-sm text-zinc-500">Add a stakeholder first.</div>;
  }

  return (
    <div className="space-y-4 max-w-xl">
      <label className="block">
        <span className="text-sm">Stakeholder</span>
        <select className="block w-full border rounded p-2" value={stakeholderId} onChange={(e) => setStakeholderId(e.target.value)}>
          {stakeholders.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.kind})
            </option>
          ))}
        </select>
      </label>
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
        <span className="text-sm">Due date</span>
        <input type="date" className="block w-full border rounded p-2" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm">Cover letter</span>
        <textarea className="block w-full border rounded p-2 h-32" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
      </label>
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !stakeholderId}
        className="px-4 py-2 rounded bg-emerald-700 text-white disabled:opacity-50"
      >
        {pending ? 'Building…' : 'Build report'}
      </button>
    </div>
  );
}
