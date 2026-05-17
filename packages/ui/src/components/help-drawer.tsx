'use client';

/**
 * Floating "?" button on every dashboard page. Click opens a 480px drawer
 * with a chat UI backed by /api/ai/chat. The drawer streams responses via
 * Server-Sent-Events (one event per token chunk).
 *
 * Pages should call useRegisterPageContext('What this page is') to set
 * the system-prompt context Claude sees.
 */

import * as React from 'react';
import { MessageCircleQuestion, Send, X, Mic, Square } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { usePageContext } from '../lib/help-context.js';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface HelpDrawerProps {
  endpoint?: string;
  transcribeEndpoint?: string;
  className?: string;
}

export function HelpDrawer({
  endpoint = '/api/ai/chat',
  transcribeEndpoint = '/api/transcribe',
  className,
}: HelpDrawerProps) {
  const { context } = usePageContext();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setMessages((curr) => [...curr, { role: 'assistant', content: '' }]);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, pageContext: context }),
      });
      if (!res.ok || !res.body) {
        setMessages((curr) => {
          const copy = [...curr];
          copy[copy.length - 1] = { role: 'assistant', content: 'AI is unavailable right now.' };
          return copy;
        });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split('\n\n');
        buf = blocks.pop() ?? '';
        for (const block of blocks) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as { delta?: string };
            if (parsed.delta) {
              setMessages((curr) => {
                const copy = [...curr];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { role: 'assistant', content: last.content + parsed.delta };
                return copy;
              });
            }
          } catch {
            // ignore malformed
          }
        }
      }
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
      fd.append('audio', blob, 'help.webm');
      fd.append('lang', 'en');
      const res = await fetch(transcribeEndpoint, { method: 'POST', body: fd });
      if (res.ok) {
        const { text } = (await res.json()) as { text?: string };
        if (text) setDraft((prev) => (prev ? prev + ' ' + text : text));
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
        aria-label="Open help"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg hover:opacity-90',
          className,
        )}
      >
        <MessageCircleQuestion size={22} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Zameen AI assistant"
          className="fixed bottom-0 right-0 top-0 z-50 flex w-[480px] max-w-full flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Zameen assistant</div>
              <div className="text-xs text-[var(--fg-muted)]">
                {context ? context.slice(0, 80) : 'Ask anything about this page'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="rounded p-1 hover:bg-[var(--surface)]"
            >
              <X size={16} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm">
            {messages.length === 0 ? (
              <div className="text-xs text-[var(--fg-muted)]">
                Try: &ldquo;What is this page for?&rdquo;, &ldquo;Show me last week&apos;s diesel anomalies&rdquo;, or
                &ldquo;Summarise this approval&rdquo;.
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'whitespace-pre-wrap rounded-md px-3 py-2',
                  m.role === 'user'
                    ? 'ml-8 bg-[var(--accent)]/10'
                    : 'mr-8 bg-[var(--surface)]',
                )}
              >
                {m.content || (m.role === 'assistant' && busy ? '...' : '')}
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Ask about this page..."
                className="flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={recording ? stopVoice : startVoice}
                aria-label={recording ? 'Stop recording' : 'Record voice'}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)]',
                  recording ? 'bg-[var(--danger)]/15 text-[var(--danger)]' : 'hover:bg-[var(--surface)]',
                )}
              >
                {recording ? <Square size={16} /> : <Mic size={16} />}
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || busy}
                aria-label="Send"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-white disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
