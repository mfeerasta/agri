/**
 * POST /api/transcribe
 *
 * Multipart body: `audio` (Blob) + optional `lang`. Proxies to OpenAI Whisper.
 * Used by HelpDrawer voice button and GlobalSearch voice button.
 */
import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const limit = rateLimit(`transcribe:${session.userId}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
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

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: upstream,
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
  }
  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: data.text ?? '' });
}
