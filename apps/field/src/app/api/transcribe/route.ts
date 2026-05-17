/**
 * POST /api/transcribe
 *
 * Multipart body: `audio` (Blob) + optional `lang` ('ur' | 'en').
 * Proxies to OpenAI Whisper as Phase 1 STT. Nemotron / Urdu-Punjabi fine-tune
 * lands in Phase 3 (see docs/decisions.md).
 */
import { NextResponse } from 'next/server';
import { getFieldSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const session = await getFieldSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'audio part missing' }, { status: 400 });
  }
  const lang = (form.get('lang') as string | null) === 'ur' ? 'ur' : 'en';

  const upstream = new FormData();
  upstream.append('file', audio, 'voice.webm');
  upstream.append('model', 'whisper-1');
  upstream.append('language', lang);
  upstream.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  });

  if (!res.ok) {
    const errorText = await res.text();
    return NextResponse.json({ error: 'Transcription failed', detail: errorText }, { status: 502 });
  }

  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: data.text ?? '' });
}
