/**
 * POST /api/ocr/diesel
 *
 * Accepts either:
 *   - application/json { imageUrl: string }
 *   - multipart/form-data with a `file` field (image is uploaded to the
 *     existing receipts bucket first, then OCRd)
 *
 * Rate-limited at 10 requests / user / minute.
 */
import { NextResponse } from 'next/server';
import { extractDieselReceipt } from '@zameen/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'zameen-receipts';

export async function POST(req: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const bucket = rateLimit(`ocr:diesel:${userData.user.id}`, 10, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: 'rate_limited', resetAt: bucket.resetAt }, { status: 429 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  let imageUrl: string | null = null;

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { imageUrl?: unknown } | null;
    if (!body || typeof body.imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    }
    imageUrl = body.imageUrl;
  } else if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    const path = `${userData.user.id}/ocr-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    imageUrl = data.publicUrl;
  } else {
    return NextResponse.json({ error: 'unsupported content type' }, { status: 415 });
  }

  const extract = await extractDieselReceipt(imageUrl);
  return NextResponse.json({ imageUrl, extract });
}
