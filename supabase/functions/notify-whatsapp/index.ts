// notify-whatsapp
//
// Dedicated dispatcher for WhatsApp-channel notifications. The general
// `notification-dispatcher` only fans out queued rows by channel and applies
// preference gating; this function owns the Meta Cloud API call path,
// templating, retry, and idempotency.
//
// Flow:
//   1. Read up to 50 rows from zameen.notifications where channel='whatsapp'
//      and sent_at is null and failed_reason is null (queued).
//   2. Resolve recipient phone from users.phone (fallback workers.phone_number).
//   3. Pick a template from the registry based on notifications.category.
//   4. POST to graph.facebook.com/v20.0/{phone_number_id}/messages with
//      Authorization: Bearer ${WHATSAPP_TOKEN}, 30s timeout.
//   5. On 429/5xx, retry with backoff 1s, 5s, 30s (max 3 attempts).
//   6. Idempotency: notification.id is sent in payload.biz_opaque_callback_data
//      so Meta dedupes; we also short-circuit if sent_at is already set.
//   7. Write back: sent_at + payload.messageId on success,
//      failed_reason + retry_count on failure.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { resolveTemplate, type TemplateDef } from './templates.ts';

const GRAPH_VERSION = 'v20.0';
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 5000, 30000];
const SEND_TIMEOUT_MS = 30000;

interface QueuedRow {
  id: string;
  recipient_id: string;
  channel: string;
  category: string;
  title: string;
  body: string;
  deep_link: string | null;
  payload: Record<string, unknown> | null;
}

interface SendOk {
  ok: true;
  messageId: string;
}

interface SendErr {
  ok: false;
  status: number;
  retriable: boolean;
  message: string;
}

type SendResult = SendOk | SendErr;

async function resolvePhone(supabase: SupabaseClient, recipientId: string): Promise<string | null> {
  const { data: u } = await supabase
    .from('users')
    .select('phone')
    .eq('id', recipientId)
    .maybeSingle();
  if (u && typeof u.phone === 'string' && u.phone.length > 0) return u.phone;
  const { data: w } = await supabase
    .from('workers')
    .select('phone')
    .eq('user_id', recipientId)
    .maybeSingle();
  if (w && typeof w.phone === 'string' && w.phone.length > 0) return w.phone;
  return null;
}

function buildTemplatePayload(
  to: string,
  tpl: TemplateDef,
  notification: QueuedRow,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    ...(notification.payload ?? {}),
    title: notification.title,
    body: notification.body,
    deepLink: notification.deep_link,
  };
  const params = tpl.params(data);
  const components: Array<Record<string, unknown>> = [];
  if (params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map((text) => ({ type: 'text', text })),
    });
  }
  if (tpl.hasUrlButton && notification.deep_link) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: notification.deep_link }],
    });
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    biz_opaque_callback_data: notification.id,
    template: {
      name: tpl.name,
      language: { code: tpl.languageCode },
      components,
    },
  };
}

async function postToMeta(payload: Record<string, unknown>): Promise<SendResult> {
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const token = Deno.env.get('WHATSAPP_TOKEN');
  if (!phoneId || !token) {
    return { ok: false, status: 0, retriable: false, message: 'missing whatsapp env' };
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
      const message = typeof (json as { error?: { message?: string } }).error?.message === 'string'
        ? (json as { error: { message: string } }).error.message
        : `http ${res.status}`;
      return { ok: false, status: res.status, retriable, message };
    }
    const messageId = (json as { messages?: Array<{ id: string }> }).messages?.[0]?.id ?? '';
    return { ok: true, messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, retriable: true, message };
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithRetry(payload: Record<string, unknown>): Promise<{ result: SendResult; attempts: number }> {
  let attempt = 0;
  let last: SendResult = { ok: false, status: 0, retriable: false, message: 'no attempt' };
  while (attempt < MAX_RETRIES) {
    last = await postToMeta(payload);
    attempt += 1;
    if (last.ok) return { result: last, attempts: attempt };
    if (!last.retriable) return { result: last, attempts: attempt };
    if (attempt >= MAX_RETRIES) break;
    const backoff = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
    await new Promise((r) => setTimeout(r, backoff));
  }
  return { result: last, attempts: attempt };
}

async function markSent(
  supabase: SupabaseClient,
  row: QueuedRow,
  messageId: string,
  attempts: number,
): Promise<void> {
  const mergedPayload = {
    ...(row.payload ?? {}),
    messageId,
    retry_count: attempts - 1,
  };
  await supabase
    .schema('zameen')
    .from('notifications')
    .update({
      sent_at: new Date().toISOString(),
      failed_reason: null,
      payload: mergedPayload,
    })
    .eq('id', row.id);
}

async function markFailed(
  supabase: SupabaseClient,
  row: QueuedRow,
  reason: string,
  attempts: number,
): Promise<void> {
  const mergedPayload = {
    ...(row.payload ?? {}),
    retry_count: attempts,
    last_error: reason.slice(0, 500),
  };
  await supabase
    .schema('zameen')
    .from('notifications')
    .update({
      failed_reason: `whatsapp_failed:${reason}`.slice(0, 1000),
      payload: mergedPayload,
    })
    .eq('id', row.id);
}

async function processOne(supabase: SupabaseClient, row: QueuedRow): Promise<'sent' | 'failed' | 'skipped'> {
  // Idempotency guard: if Meta messageId already stored, treat as sent.
  const existingId = (row.payload as { messageId?: string } | null)?.messageId;
  if (existingId && existingId.length > 0) {
    await markSent(supabase, row, existingId, 1);
    return 'sent';
  }

  const tpl = resolveTemplate(row.category);
  if (!tpl) {
    await markFailed(supabase, row, `no_template_for_category:${row.category}`, 0);
    return 'failed';
  }

  const phone = await resolvePhone(supabase, row.recipient_id);
  if (!phone) {
    await markFailed(supabase, row, 'no_phone_on_recipient', 0);
    return 'failed';
  }

  const payload = buildTemplatePayload(phone, tpl, row);
  const { result, attempts } = await sendWithRetry(payload);
  if (result.ok) {
    await markSent(supabase, row, result.messageId, attempts);
    return 'sent';
  }
  await markFailed(supabase, row, `${result.status}:${result.message}`, attempts);
  return 'failed';
}

Deno.serve(instrument('notify-whatsapp', async (_req: Request) => {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .schema('zameen')
    .from('notifications')
    .select('id, recipient_id, channel, category, title, body, deep_link, payload')
    .eq('channel', 'whatsapp')
    .is('sent_at', null)
    .is('failed_reason', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return jsonResponse({ error: error.message }, 500);

  const rows = (data ?? []) as QueuedRow[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const outcome = await processOne(supabase, row);
      if (outcome === 'sent') sent += 1;
      else if (outcome === 'failed') failed += 1;
      else skipped += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await markFailed(supabase, row, `dispatcher_error:${message}`, 0);
      failed += 1;
    }
  }

  return jsonResponse({
    recordsProcessed: rows.length,
    sent,
    failed,
    skipped,
  });
}));
