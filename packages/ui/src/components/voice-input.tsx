'use client';
import * as React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { BigButton } from './big-button.js';

export interface VoiceInputProps {
  onResult: (transcript: string) => void;
  lang?: 'ur-PK' | 'en-PK';
  label?: string;
}

/**
 * Phase-1 voice input uses the browser's SpeechRecognition API (Chrome on
 * Android supports Urdu reasonably well). Phase-3 will swap this for a
 * Whisper/Nemotron endpoint for noisy field environments.
 */
export function VoiceInput({ onResult, lang = 'ur-PK', label = 'Speak' }: VoiceInputProps) {
  const [listening, setListening] = React.useState(false);
  const [supported] = React.useState(() =>
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  );
  const recogRef = React.useRef<any>(null);

  function start() {
    if (!supported) return;
    const Ctor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recog = new Ctor();
    recog.lang = lang;
    recog.interimResults = false;
    recog.continuous = false;
    recog.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? '';
      if (text) onResult(text);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }
  function stop() {
    recogRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;
  return (
    <BigButton
      type="button"
      icon={listening ? <MicOff /> : <Mic />}
      label={listening ? 'Listening…' : label}
      onClick={listening ? stop : start}
      tone={listening ? 'warning' : 'neutral'}
    />
  );
}
