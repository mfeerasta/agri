'use client';
import * as React from 'react';
import { reviewDiagnostic } from '../actions';

type Status = 'pending_review' | 'confirmed' | 'dismissed' | 'treated' | 'resolved';

export function DiagnosticReviewActions({
  id,
  currentStatus,
  treatmentSuggestion,
  cropPlanId,
}: {
  id: string;
  currentStatus: Status;
  treatmentSuggestion: string;
  cropPlanId: string | null;
}) {
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(currentStatus);
  const [error, setError] = React.useState<string | null>(null);

  const setTo = async (next: Status) => {
    setPending(true);
    setError(null);
    const result = await reviewDiagnostic({ id, status: next });
    setPending(false);
    if (result.ok) setStatus(next);
    else setError(result.error);
  };

  const createTask = () => {
    const url = new URL('/tasks/new', window.location.origin);
    url.searchParams.set('description', `Treatment for diagnostic ${id}: ${treatmentSuggestion}`);
    if (cropPlanId) url.searchParams.set('cropPlanId', cropPlanId);
    window.location.href = url.toString();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">Current status: <span className="font-medium">{status}</span></p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => setTo('confirmed')} className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">Confirm</button>
        <button type="button" disabled={pending} onClick={() => setTo('dismissed')} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Dismiss</button>
        <button type="button" disabled={pending} onClick={() => setTo('treated')} className="rounded-md bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50">Mark treated</button>
        <button type="button" disabled={pending} onClick={() => setTo('resolved')} className="rounded-md bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50">Mark resolved</button>
        <button type="button" onClick={createTask} className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-700">Create treatment task</button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
