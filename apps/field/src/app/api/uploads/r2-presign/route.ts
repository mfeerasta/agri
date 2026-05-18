/**
 * POST /api/uploads/r2-presign
 *
 * Two modes, chosen by Content-Type of the incoming request:
 *
 * 1. multipart/form-data — the route receives the (already compressed) file
 *    blob, uploads it to R2 server-side, and returns `{ url }`. This matches
 *    the contract expected by `PhotoCapture.uploadFn` in @zameen/ui.
 *
 * 2. application/json — returns a presigned PUT URL so the browser uploads
 *    binary content directly to R2 (preferred path for large files; used by
 *    the offline-queue photo drain in apps/field/src/lib/offline-queue.ts).
 */
import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { presignPut } from '@zameen/shared/r2';
import { safeStringify, toUserMessage, errorStatus } from '@zameen/shared';
import { getFieldSession } from '../../../../lib/session';
import {
  validateFileUpload,
  PHOTO_MIMES,
  PHOTO_MAX_BYTES,
} from '../../../../lib/file-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildKey(prefix: string, userId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${prefix}/${userId}/${Date.now()}-${safe}`;
}

function publicUrlFor(key: string): string {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
}

function r2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials missing');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function POST(req: Request): Promise<Response> {
  const session = await getFieldSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const form = await req.formData();
      const file = form.get('file');
      const prefixRaw = (form.get('prefix') as string | null) ?? 'field';
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'file part missing' }, { status: 400 });
      }
      const verdict = await validateFileUpload(file, {
        allowedMimes: PHOTO_MIMES,
        maxBytes: PHOTO_MAX_BYTES,
      });
      if (!verdict.ok) {
        return NextResponse.json({ error: verdict.error ?? 'invalid file' }, { status: 400 });
      }
      const filename = (file as File).name ?? 'upload.bin';
      const key = buildKey(prefixRaw, session.userId, filename);
      const bucket = process.env.CLOUDFLARE_R2_BUCKET;
      if (!bucket) {
        return NextResponse.json({ error: 'R2 bucket not configured' }, { status: 500 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      await r2Client().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: verdict.detectedMime ?? 'application/octet-stream',
        }),
      );
      const url = publicUrlFor(key);
      return NextResponse.json({ url, key, publicUrl: url });
    } catch (e) {
      console.error(safeStringify({ scope: 'uploads/r2-presign/multipart', err: String(e) }));
      return NextResponse.json({ error: toUserMessage(e) }, { status: errorStatus(e) });
    }
  }

  if (contentType.includes('application/json')) {
    const body = (await req.json()) as {
      filename?: string;
      contentType?: string;
      prefix?: string;
    };
    const prefix = body.prefix ?? 'field';
    const filename = body.filename ?? `upload-${Date.now()}.bin`;
    const ct = body.contentType ?? 'application/octet-stream';
    const key = buildKey(prefix, session.userId, filename);
    const { url } = await presignPut({ key, contentType: ct });
    const publicUrl = publicUrlFor(key);
    return NextResponse.json({ uploadUrl: url, url: publicUrl, key, publicUrl });
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
}
