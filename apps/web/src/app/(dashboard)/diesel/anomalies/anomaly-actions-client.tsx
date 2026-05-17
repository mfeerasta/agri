'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { acknowledgeAnomaly, dismissAnomaly, resolveAnomaly } from '@/modules/diesel/anomaly-actions';

interface Props {
  id: string;
  logId: string | null;
}

export function AnomalyActions({ id, logId }: Props) {
  const [busy, startTransition] = useTransition();
  const [mode, setMode] = useState<'idle' | 'dismiss' | 'resolve'>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Action failed');
      else {
        setMode('idle');
        setText('');
      }
    });
  };

  return (
    <div className="border-t border-[var(--border)] pt-3 space-y-2">
      {mode === 'idle' ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(() => acknowledgeAnomaly(id))}
            className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem] hover:bg-[var(--ink)] hover:text-[var(--paper)]"
          >
            Acknowledge
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode('resolve')}
            className="border border-[var(--success)] text-[var(--success)] px-3 py-1 smallcaps text-[0.7rem]"
          >
            Resolve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode('dismiss')}
            className="border border-[var(--fg-muted)] text-[var(--fg-muted)] px-3 py-1 smallcaps text-[0.7rem]"
          >
            Dismiss
          </button>
          {logId ? (
            <Link
              href={`/diesel/logs/${logId}` as never}
              className="text-xs text-[var(--accent)] underline ml-auto"
            >
              View daily log
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={mode === 'dismiss' ? 'Why dismiss this anomaly?' : 'Resolution notes (parts replaced, calibration, etc.)'}
            className="w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() =>
                submit(() =>
                  mode === 'dismiss' ? dismissAnomaly(id, text) : resolveAnomaly(id, text),
                )
              }
              className="border border-[var(--ink)] px-3 py-1 smallcaps text-[0.7rem] hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
            >
              {mode === 'dismiss' ? 'Confirm dismiss' : 'Confirm resolve'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode('idle');
                setText('');
              }}
              className="text-xs text-[var(--fg-muted)] underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error ? <div className="text-xs text-[var(--danger)]">{error}</div> : null}
    </div>
  );
}
