/**
 * POST /api/ocr/diesel (field PWA)
 *
 * Mirrors the web-app endpoint. Accepts { imageUrl } JSON or multipart `file`.
 * Rate-limited per session user at 10 req/min.
 */
import { NextResponse } from 'next/server';
import { extractDieselReceipt } from '@zameen/shared';
import { getFieldSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getFieldSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!rateLimit(`ocr:diesel:${session.userId}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'json only' }, { status: 415 });
  }
  const body = (await req.json().catch(() => null)) as { imageUrl?: unknown } | null;
  if (!body || typeof body.imageUrl !== 'string') {
    return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
  }
  const extract = await extractDieselReceipt(body.imageUrl);
  return NextResponse.json({ imageUrl: body.imageUrl, extract });
}
