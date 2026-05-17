'use client';
import * as React from 'react';

export function BackfillButton() {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/diagnostics/backfill', { method: 'POST' });
      const json = (await res.json()) as { processed?: number; error?: string };
      if (!res.ok) setMessage(json.error ?? 'failed');
      else setMessage(`Processed ${json.processed ?? 0} photos`);
    } catch {
      setMessage('network error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-700 disabled:opacity-50"
      >
        {pending ? 'Running' : 'Run on stage photos (100)'}
      </button>
    </div>
  );
}
