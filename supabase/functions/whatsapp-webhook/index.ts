// whatsapp-webhook
//
// Handles two Meta WhatsApp Cloud API payload shapes on the same endpoint:
//
// 1. Delivery status updates ({ statuses: [...] }) — match against
//    zameen.notifications.payload->>messageId and record sent / delivered /
//    read / failed.
//
// 2. Inbound user messages ({ messages: [...] }) — look up the sender by
//    phone in zameen.users, call the Claude NLU parser, dispatch into the
//    matching zameen module (task_completions, diesel_daily_logs, etc),
//    and reply in the worker's preferred locale.
//
// HMAC verification with META_WHATSAPP_APP_SECRET is preserved on every
// POST. GET handles the hub.challenge verification.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { parseMessage, type NluContextHints } from '../../../packages/shared/src/nlu.ts';
import { processIntent, type ZameenUser } from './process-intent.ts';
import { pickLocale, replies, type Locale } from './replies.ts';
import { normalisePhone, sendWhatsAppText } from './send-text.ts';

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title?: string; message?: string }>;
}

interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
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

// deno-lint-ignore no-explicit-any
async function processStatuses(supabase: any, statuses: MetaStatus[]): Promise<number> {
  let updated = 0;
  for (const status of statuses) {
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
  return updated;
}

// deno-lint-ignore no-explicit-any
async function lookupUserByPhone(supabase: any, from: string): Promise<ZameenUser | null> {
  const candidates = normalisePhone(from);
  const { data } = await supabase
    .from('users')
    .select('id, default_entity_id, primary_role, preferred_locale, full_name, phone')
    .in('phone', candidates)
    .limit(1)
    .maybeSingle();
  return (data as ZameenUser | null) ?? null;
}

// deno-lint-ignore no-explicit-any
async function buildContextHints(supabase: any, entityId: string): Promise<NluContextHints> {
  const [fieldsRes, assetsRes, tasksRes] = await Promise.all([
    supabase
      .from('fields')
      .select('id, code, name_ur, blocks!inner(farms!inner(entity_id))')
      .eq('blocks.farms.entity_id', entityId)
      .limit(50),
    supabase
      .from('assets')
      .select('id, code, category')
      .eq('entity_id', entityId)
      .eq('is_active', true)
      .limit(50),
    supabase
      .from('tasks')
      .select('id, title')
      .eq('entity_id', entityId)
      .eq('status', 'open')
      .limit(30),
  ]);
  return {
    activeFieldIds: (fieldsRes.data ?? []).map((f: { id: string; code: string; name_ur: string | null }) => ({
      id: f.id,
      code: f.code,
      nameUr: f.name_ur ?? undefined,
    })),
    activeAssetIds: (assetsRes.data ?? []).map((a: { id: string; code: string; category: string }) => ({
      id: a.id,
      code: a.code,
      category: a.category,
    })),
    activeTaskCodes: (tasksRes.data ?? []).map((t: { id: string; title: string }) => ({
      id: t.id,
      title: t.title,
    })),
  };
}

// deno-lint-ignore no-explicit-any
async function processInboundMessages(supabase: any, messages: MetaInboundMessage[]): Promise<number> {
  let handled = 0;
  for (const msg of messages) {
    if (msg.type !== 'text' || !msg.text?.body) continue;
    const text = msg.text.body.trim();
    if (!text) continue;
    const user = await lookupUserByPhone(supabase, msg.from);
    if (!user) {
      await sendWhatsAppText(msg.from, pickLocale(replies.unknownSender, 'ur' as Locale));
      handled++;
      continue;
    }

    const hints = user.default_entity_id
      ? await buildContextHints(supabase, user.default_entity_id)
      : undefined;

    const parsed = await parseMessage({
      text,
      senderPhone: msg.from,
      senderUserId: user.id,
      contextHints: hints,
    });

    const result = await processIntent({ supabase, user, intent: parsed });
    if (result.reply) {
      await sendWhatsAppText(msg.from, result.reply);
    }
    handled++;
  }
  return handled;
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
  let statusesUpdated = 0;
  let messagesHandled = 0;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      if (value.statuses && value.statuses.length > 0) {
        statusesUpdated += await processStatuses(supabase, value.statuses);
      }
      if (value.messages && value.messages.length > 0) {
        messagesHandled += await processInboundMessages(supabase, value.messages);
      }
    }
  }

  return jsonResponse({ statusesUpdated, messagesHandled });
});
