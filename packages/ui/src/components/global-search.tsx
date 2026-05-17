'use client';

/**
 * Global voice + text search. Press "/" anywhere on the dashboard to open.
 * Sends the query to /api/ai/search which returns a Claude-grounded answer
 * with citations to entity records (fields, crop plans, vendors, approvals,
 * journal entries).
 */

import * as React from 'react';
import { Search, X, Mic, Square } from 'lucide-react';
import Link from 'next/link';
import { cn } from '../lib/cn.js';

export interface Citation {
  kind: 'field' | 'crop_plan' | 'vendor' | 'worker' | 'journal_entry' | 'approval_request';
  id: string;
  label: string;
  deepLink: string;
}

export interface GlobalSearchProps {
  endpoint?: string;
  transcribeEndpoint?: string;
  className?: string;
}

export function GlobalSearch({
  endpoint = '/api/ai/search',
  transcribeEndpoint = '/api/transcribe',
  className,
}: GlobalSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState('');
  const [citations, setCitations] = React.useState<Citation[]>([]);
  const [recording, setRecording] = React.useState(false);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if (e.key === '/' && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function run(): Promise<void> {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer('');
    setCitations([]);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        setAnswer('Search is unavailable right now.');
        return;
      }
      const data = (await res.json()) as { answer?: string; citations?: Citation[] };
      setAnswer(data.answer ?? '');
      setCitations(data.citations ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function startVoice(): Promise<void> {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const fd = new FormData();
      fd.append('audio', blob, 'search.webm');
      fd.append('lang', 'en');
      const res = await fetch(transcribeEndpoint, { method: 'POST', body: fd });
      if (res.ok) {
        const { text } = (await res.json()) as { text?: string };
        if (text) {
          setQuery(text);
          setTimeout(() => void run(), 0);
        }
      }
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  function stopVoice(): void {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className={cn(
          'flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-xs text-[var(--fg-muted)] hover:bg-[var(--surface)]',
          className,
        )}
      >
        <Search size={14} />
        <span>Search</span>
        <kbd className="ml-2 rounded border border-[var(--border)] px-1 font-mono text-[10px]">/</kbd>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Global search"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Search size={16} className="text-[var(--fg-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void run();
                }}
                placeholder="Ask about your farm. Try: how much diesel did Block A use last week?"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={recording ? stopVoice : startVoice}
                aria-label={recording ? 'Stop recording' : 'Voice search'}
                className={cn(
                  'rounded p-1.5',
                  recording ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : 'hover:bg-[var(--surface)]',
                )}
              >
                {recording ? <Square size={14} /> : <Mic size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="rounded p-1.5 hover:bg-[var(--surface)]"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-4 py-4 text-sm">
              {busy ? (
                <div className="text-xs text-[var(--fg-muted)]">Thinking...</div>
              ) : answer ? (
                <>
                  <p className="whitespace-pre-wrap">{answer}</p>
                  {citations.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {citations.map((c) => (
                        <Link
                          key={`${c.kind}-${c.id}`}
                          href={c.deepLink as never}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs hover:bg-[var(--bg-2)]"
                          onClick={() => setOpen(false)}
                        >
                          <span className="text-[var(--fg-muted)]">{c.kind}</span>{' '}
                          <span>{c.label}</span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-[var(--fg-muted)]">
                  Type a question and press Enter. You can also press the mic to talk.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
