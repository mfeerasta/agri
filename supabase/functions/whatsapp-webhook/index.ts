// whatsapp-webhook
// POST handler for Meta WhatsApp Business delivery receipts.
// Verifies X-Hub-Signature-256 HMAC against the raw body using
// META_WHATSAPP_APP_SECRET, then matches each status update against
// zameen.notifications.payload->>messageId to record sent/delivered/read/failed.
// GET handler responds to Meta's hub.challenge verification.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title?: string; message?: string }>;
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{ value?: { statuses?: MetaStatus[] } }>;
  }>;
}

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get('META_WHATSAPP_APP_SECRET');
  if (!secret) return false;
  if (!header) return false;
  const expectedPrefix = 'sha256=';
  if (!header.startsWith(expectedPrefix)) return false;
  const provided = header.slice(expectedPrefix.length);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (computed.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expected && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-hub-signature-256');
  const ok = await verifySignature(rawBody, signatureHeader);
  if (!ok) return jsonResponse({ error: 'invalid signature' }, 401);

  let body: MetaPayload;
  try {
    body = JSON.parse(rawBody) as MetaPayload;
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  const supabase = getServiceClient();
  let updated = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const externalId = status.id;
        const ts = new Date(Number(status.timestamp) * 1000).toISOString();
        const update: Record<string, string | null> = {};
        if (status.status === 'sent' || status.status === 'delivered') update.sent_at = ts;
        if (status.status === 'read') update.read_at = ts;
        if (status.status === 'failed') {
          const err = status.errors?.[0];
          update.failed_reason = err
            ? `whatsapp_failed: ${err.code}${err.title ? ' ' + err.title : ''}`
            : 'whatsapp_failed';
        }
        if (Object.keys(update).length === 0) continue;

        const { error, count } = await supabase
          .schema('zameen')
          .from('notifications')
          .update(update, { count: 'exact' })
          .filter('payload->>messageId', 'eq', externalId);
        if (!error) updated += count ?? 0;
      }
    }
  }

  return jsonResponse({ updated });
});
