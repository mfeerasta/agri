// cloudflare-r2-presigned-url
// POST {contentType, prefix} -> returns {url, key, headers} for a SigV4 presigned PUT.
// R2 exposes an S3-compatible endpoint. Required env:
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
//   R2_REGION (defaults to "auto")

import { jsonResponse } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
interface Body {
  contentType?: string;
  prefix?: string;
}

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(data));
  return toHex(hash);
}

function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function randomId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(instrument('cloudflare-r2-presigned-url', async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKey = Deno.env.get('R2_ACCESS_KEY_ID');
  const secret = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucket = Deno.env.get('R2_BUCKET');
  const region = Deno.env.get('R2_REGION') ?? 'auto';
  if (!accountId || !accessKey || !secret || !bucket) {
    return jsonResponse({ error: 'R2 credentials missing' }, 500);
  }

  let body: Body;
  try {
    body = await req.json() as Body;
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  const contentType = body.contentType ?? 'application/octet-stream';
  const prefix = (body.prefix ?? 'uploads').replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomId()}`;

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const expires = 600;

  const credential = `${accessKey}/${dateStamp}/${region}/s3/aws4_request`;
  const canonicalUri = `/${bucket}/${key.split('/').map(rfc3986).join('/')}`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/s3/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmac(enc.encode(`AWS4${secret}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 's3');
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  const url = `https://${host}${canonicalUri}?${finalQuery}`;

  return jsonResponse({
    url,
    key,
    headers: { 'content-type': contentType },
    expiresIn: expires,
  });
}));
