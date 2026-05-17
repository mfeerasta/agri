'use client';
import * as React from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface VoiceNoteProps {
  onTranscript: (text: string) => void;
  endpoint?: string;
  lang?: 'ur-PK' | 'en-PK';
  className?: string;
}

export function VoiceNote({ onTranscript, endpoint = '/api/transcribe', lang = 'ur-PK', className }: VoiceNoteProps) {
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  async function start() {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'voice-note.webm');
        fd.append('lang', lang);
        const res = await fetch(endpoint, { method: 'POST', body: fd });
        if (res.ok) {
          const { text } = await res.json();
          if (text) onTranscript(text);
        }
      } finally {
        setBusy(false);
      }
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={busy}
      className={cn(
        'group flex items-center gap-3 border border-[var(--rule)] px-4 py-3 transition-colors',
        recording ? 'bg-[var(--clay)] text-[var(--paper)]' : 'bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-2)]',
        className,
      )}
    >
      {recording ? <Square size={18} strokeWidth={1.5} /> : <Mic size={18} strokeWidth={1.5} />}
      <span className="smallcaps text-[0.75rem]">
        {busy ? 'Transcribing' : recording ? 'Recording' : 'Voice note'}
      </span>
    </button>
  );
}
