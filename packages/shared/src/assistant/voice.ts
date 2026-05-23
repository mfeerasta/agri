/**
 * Voice helpers for the AI assistant.
 *
 *  - transcribeAudio: Whisper STT. Auto-detects ur/en for Roman Urdu we hint.
 *  - synthesizeSpeech: TTS via ElevenLabs (preferred) with an OpenAI fallback.
 *
 * Both functions degrade gracefully when keys are missing.
 */

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const ELEVEN_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const VOICE_TIMEOUT_MS = 45_000;

export type VoiceLocale = 'en' | 'ur' | 'roman_ur';

function langForWhisper(locale: VoiceLocale): string {
  if (locale === 'ur' || locale === 'roman_ur') return 'ur';
  return 'en';
}

/** Whisper STT. Returns plain text. Empty string on failure or missing key. */
export async function transcribeAudio(audioUrl: string, locale: VoiceLocale): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
  try {
    const audioRes = await fetch(audioUrl, { signal: controller.signal });
    if (!audioRes.ok) return '';
    const blob = await audioRes.blob();

    const form = new FormData();
    form.append('file', blob, 'voice.webm');
    form.append('model', 'whisper-1');
    form.append('language', langForWhisper(locale));
    form.append('response_format', 'text');

    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) return '';
    return (await res.text()).trim();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export interface SynthesisResult {
  audioBytes: Uint8Array;
  contentType: string;
}

/** TTS. Tries ElevenLabs first, falls back to OpenAI. */
export async function synthesizeSpeech(
  text: string,
  locale: VoiceLocale,
): Promise<SynthesisResult | null> {
  if (!text.trim()) return null;
  const eleven = await elevenLabsTts(text, locale);
  if (eleven) return eleven;
  return openAiTts(text, locale);
}

async function elevenLabsTts(text: string, locale: VoiceLocale): Promise<SynthesisResult | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  // ZAMEEN_TTS_VOICE_UR / _EN map to ElevenLabs voice ids per env.
  const voiceId =
    locale === 'ur' || locale === 'roman_ur'
      ? process.env.ZAMEEN_TTS_VOICE_UR ?? 'pNInz6obpgDQGcFmaJgB'
      : process.env.ZAMEEN_TTS_VOICE_EN ?? 'pNInz6obpgDQGcFmaJgB';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${ELEVEN_TTS_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return { audioBytes: buf, contentType: 'audio/mpeg' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function openAiTts(text: string, _locale: VoiceLocale): Promise<SynthesisResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'mp3',
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return { audioBytes: buf, contentType: 'audio/mpeg' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
