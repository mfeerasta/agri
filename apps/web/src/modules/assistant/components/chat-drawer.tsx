'use client';

import { useEffect, useRef, useState } from 'react';
import { startConversation, sendAssistantMessage } from '../actions';

type Bubble =
  | { role: 'user' | 'assistant'; text: string }
  | { role: 'tool'; name: string; payload: unknown };

export interface ChatDrawerProps {
  locale?: 'en' | 'ur' | 'roman_ur';
}

export function ChatDrawer({ locale = 'en' }: ChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open || conversationId) return;
    startConversation({ channel: 'web' }).then((res) => {
      if (res.ok) setConversationId(res.data.id);
    });
  }, [open, conversationId]);

  async function send(message?: string, voiceUrl?: string) {
    if (!conversationId) return;
    const userText = message ?? text.trim();
    if (!userText && !voiceUrl) return;
    setBubbles((b) => [...b, { role: 'user', text: userText || '[voice]' }]);
    setText('');
    setBusy(true);
    const res = await sendAssistantMessage({
      conversationId,
      userMessage: userText || undefined,
      voiceUrl,
      locale,
    });
    setBusy(false);
    if (res.ok) {
      setBubbles((b) => [...b, { role: 'assistant', text: res.data.text }]);
    } else {
      setBubbles((b) => [...b, { role: 'assistant', text: 'Error: ' + res.error }]);
    }
  }

  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Upload to existing /api/uploads then send url.
        const form = new FormData();
        form.append('file', blob, 'voice.webm');
        const up = await fetch('/api/uploads', { method: 'POST', body: form });
        if (up.ok) {
          const { url } = (await up.json()) as { url: string };
          await send('', url);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700"
        aria-label="Open assistant"
      >
        AI
      </button>
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 p-4">
            <h2 className="font-semibold">Zameen Assistant</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              X
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {bubbles.map((b, i) =>
              b.role === 'tool' ? (
                <div key={i} className="rounded bg-amber-50 p-2 text-xs text-amber-900">
                  tool: {b.name}
                </div>
              ) : (
                <div
                  key={i}
                  className={
                    b.role === 'user'
                      ? 'ml-auto max-w-[80%] rounded-2xl bg-emerald-600 px-3 py-2 text-sm text-white'
                      : 'mr-auto max-w-[80%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-900'
                  }
                >
                  {b.text}
                </div>
              ),
            )}
            {busy && <div className="text-xs text-gray-500">Thinking...</div>}
          </div>
          <footer className="flex items-center gap-2 border-t border-gray-200 p-3">
            <button
              type="button"
              onClick={toggleRecord}
              className={
                'rounded-full px-3 py-2 text-sm ' +
                (recording ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800')
              }
            >
              {recording ? 'Stop' : 'Mic'}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask about fields, finance, diesel..."
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Send
            </button>
          </footer>
        </div>
      )}
    </>
  );
}
