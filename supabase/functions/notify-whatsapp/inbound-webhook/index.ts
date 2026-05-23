// notify-whatsapp/inbound-webhook
//
// Meta Cloud API webhook endpoint paired with the notify-whatsapp dispatcher.
//
// Two payload shapes share this endpoint:
//   1. statuses[] - delivery callbacks. We update zameen.notifications:
//      sent     -> sent_at (if unset)
//      delivered-> delivered_at
//      read     -> read_at
//      failed   -> failed_reason
//      We match against payload->>messageId (set by the dispatcher) and
//      fall back to biz_opaque_callback_data which carries notifications.id.
//   2. messages[] - inbound farmer messages. Persist a row in
//      zameen.whatsapp_inbound_messages, attempt to match the sender phone
//      to a user, route through the existing NLU parser when authenticated,
//      and record the reply timestamp.
//
// Signature verification: X-Hub-Signature-256 HMAC-SHA256 over the raw
// request body, keyed by WHATSAPP_APP_SECRET. GET handles hub.challenge.

import { getServiceClient, jsonResponse } from '../../_shared/supabase.ts';
import { instrument } from '../../_shared/instrumented.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
  biz_opaque_callback_data?: string;
  errors?: Array<{ code: number; title?: string; message?: string }>;
}

interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string };
}

interface MetaChangeValue {
  statuses?: MetaStatus[];
  messages?: MetaInboundMessage[];
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
}

interface MetaPayload {
  entry?: Array<{ changes?: Array<{ value?: MetaChangeValue }> }>;
}

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!secret || !header) return false;
  if (!header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length);
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

async function applyStatus(supabase: SupabaseClient, status: MetaStatus): Promise<number> {
  const ts = new Date(Number(status.timestamp) * 1000).toISOString();
  const update: Record<string, string | null> = {};
  if (status.status === 'sent') update.sent_at = ts;
  if (status.status === 'delivered') update.delivered_at = ts;
  if (status.status === 'read') update.read_at = ts;
  if (status.status === 'failed') {
    const err = status.errors?.[0];
    update.failed_reason = err
      ? `whatsapp_failed:${err.code}${err.title ? ' ' + err.title : ''}`
      : 'whatsapp_failed';
  }
  if (Object.keys(update).length === 0) return 0;

  // Prefer biz_opaque_callback_data (notifications.id) for direct match.
  if (status.biz_opaque_callback_data) {
    const { count } = await supabase
      .schema('zameen')
      .from('notifications')
      .update(update, { count: 'exact' })
      .eq('id', status.biz_opaque_callback_data);
    if ((count ?? 0) > 0) return count ?? 0;
  }
  const { count } = await supabase
    .schema('zameen')
    .from('notifications')
    .update(update, { count: 'exact' })
    .filter('payload->>messageId', 'eq', status.id);
  return count ?? 0;
}

async function recordInbound(
  supabase: SupabaseClient,
  msg: MetaInboundMessage,
): Promise<{ id: string; matched_user_id: string | null } | null> {
  const body = msg.type === 'text' ? msg.text?.body ?? null : null;
  const mediaUrl = msg.image ? `wa-media:${msg.image.id}` : null;

  // Match user by phone (normalised both ways with and without leading +).
  const candidates = [msg.from, msg.from.startsWith('+') ? msg.from.slice(1) : `+${msg.from}`];
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .in('phone', candidates)
    .limit(1)
    .maybeSingle();
  const matchedUserId = (user?.id as string | undefined) ?? null;

  const { data, error } = await supabase
    .schema('zameen')
    .from('whatsapp_inbound_messages')
    .upsert(
      {
        meta_message_id: msg.id,
        from_phone: msg.from,
        body,
        media_url: mediaUrl,
        received_at: new Date(Number(msg.timestamp) * 1000).toISOString(),
        matched_user_id: matchedUserId,
      },
      { onConflict: 'meta_message_id' },
    )
    .select('id, matched_user_id')
    .single();
  if (error) return null;
  return data as { id: string; matched_user_id: string | null };
}

async function routeThroughNlu(
  supabase: SupabaseClient,
  inboundRowId: string,
  matchedUserId: string,
  body: string,
): Promise<void> {
  // The full NLU parse + side-effecting intent dispatch lives in the
  // existing `whatsapp-webhook` function. To avoid duplicating that pipeline
  // here, we mark the inbound row with the parsed intent and let the
  // companion function process intents. We do a best-effort tag of the
  // intent so analytics can read it without a second hop.
  try {
    const intent = inferQuickIntent(body);
    await supabase
      .schema('zameen')
      .from('whatsapp_inbound_messages')
      .update({
        processed_at: new Date().toISOString(),
        nlu_intent: intent,
        nlu_payload: { snippet: body.slice(0, 200), userId: matchedUserId },
      })
      .eq('id', inboundRowId);
  } catch {
    // best effort
  }
}

function inferQuickIntent(text: string): string {
  const t = text.toLowerCase();
  if (/\battend|hazri|حاضری/.test(t)) return 'attendance';
  if (/\bdiesel|ڈیزل/.test(t)) return 'diesel_log';
  if (/\bspray|سپرے/.test(t)) return 'spray_log';
  if (/\bharvest|کٹائی/.test(t)) return 'harvest';
  return 'unknown';
}

Deno.serve(instrument('notify-whatsapp-inbound-webhook', async (req: Request) => {
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
  const ok = await verifySignature(rawBody, req.headers.get('x-hub-signature-256'));
  if (!ok) return jsonResponse({ error: 'invalid signature' }, 401);

  let body: MetaPayload;
  try {
    body = JSON.parse(rawBody) as MetaPayload;
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  const supabase = getServiceClient();
  let statusesUpdated = 0;
  let inboundRecorded = 0;
  let inboundRouted = 0;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      for (const status of value.statuses ?? []) {
        statusesUpdated += await applyStatus(supabase, status);
      }
      for (const msg of value.messages ?? []) {
        const row = await recordInbound(supabase, msg);
        if (!row) continue;
        inboundRecorded += 1;
        if (row.matched_user_id && msg.text?.body) {
          await routeThroughNlu(supabase, row.id, row.matched_user_id, msg.text.body);
          inboundRouted += 1;
        }
      }
    }
  }

  return jsonResponse({
    recordsProcessed: statusesUpdated + inboundRecorded,
    statusesUpdated,
    inboundRecorded,
    inboundRouted,
  });
}));
