// sms-dispatcher
//
// Dispatches queued rows from zameen.sms_deliveries. Mirrors the
// notify-whatsapp shape so the same operational runbook applies.
//
// Flow:
//   1. Pull up to 50 rows where status='queued' ordered by created_at.
//   2. POST to the configured provider (Twilio primary, PTCL fallback).
//   3. On 429/5xx, retry with backoff 1s, 5s, 30s (max 3 attempts).
//   4. On success: status='sent', sent_at=now(), provider_message_id set.
//   5. On non-retriable failure: status='failed', failure_reason set.
//   6. Delivery receipts (status='delivered'/'undelivered') arrive via
//      provider webhook handled separately.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 5000, 30000];
const SEND_TIMEOUT_MS = 30000;

type Provider = 'twilio' | 'ptcl' | 'jazz' | 'easypaisa';

interface QueuedRow {
  id: string;
  recipient_phone: string;
  body: string;
  body_language: string;
  segments: number;
  provider: string;
  notification_id: string | null;
}

interface SendOk {
  ok: true;
  providerMessageId: string;
}

interface SendErr {
  ok: false;
  status: number;
  retriable: boolean;
  message: string;
}

type SendResult = SendOk | SendErr;

function primaryProvider(): Provider {
  return (Deno.env.get('SMS_PROVIDER') as Provider) ?? 'twilio';
}

function fallbackProvider(): Provider | null {
  return (Deno.env.get('SMS_FALLBACK_PROVIDER') as Provider) ?? null;
}

async function postWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaTwilio(to: string, body: string): Promise<SendResult> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) {
    return { ok: false, status: 0, retriable: false, message: 'twilio env missing' };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  try {
    const res = await postWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
    };
    if (!res.ok) {
      const retriable = res.status === 429 || res.status >= 500;
      return {
        ok: false,
        status: res.status,
        retriable,
        message: json.message ?? `twilio http ${res.status}`,
      };
    }
    return { ok: true, providerMessageId: json.sid ?? '' };
  } catch (e) {
    return { ok: false, status: 0, retriable: true, message: e instanceof Error ? e.message : String(e) };
  }
}

async function sendViaPtcl(to: string, body: string): Promise<SendResult> {
  const user = Deno.env.get('PTCL_SMS_USERNAME');
  const pass = Deno.env.get('PTCL_SMS_PASSWORD');
  if (!user || !pass) {
    return { ok: false, status: 0, retriable: false, message: 'ptcl env missing' };
  }
  const url = new URL('https://sms.ptcl.com.pk/api/send');
  url.searchParams.set('username', user);
  url.searchParams.set('password', pass);
  url.searchParams.set('to', to);
  url.searchParams.set('text', body);
  try {
    const res = await postWithTimeout(url.toString(), { method: 'GET' });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        retriable: res.status >= 500,
        message: `ptcl http ${res.status}`,
      };
    }
    if (text.startsWith('ERR')) {
      return { ok: false, status: 502, retriable: false, message: text };
    }
    const match = text.match(/OK\s+(\S+)/);
    return { ok: true, providerMessageId: match ? match[1] : '' };
  } catch (e) {
    return { ok: false, status: 0, retriable: true, message: e instanceof Error ? e.message : String(e) };
  }
}

async function sendOnce(provider: Provider, to: string, body: string): Promise<SendResult> {
  if (provider === 'twilio') return sendViaTwilio(to, body);
  return sendViaPtcl(to, body);
}

async function sendWithRetry(
  provider: Provider,
  to: string,
  body: string,
): Promise<{ result: SendResult; attempts: number }> {
  let attempt = 0;
  let last: SendResult = { ok: false, status: 0, retriable: false, message: 'no attempt' };
  while (attempt < MAX_RETRIES) {
    last = await sendOnce(provider, to, body);
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
  provider: Provider,
  providerMessageId: string,
): Promise<void> {
  await supabase
    .schema('zameen')
    .from('sms_deliveries')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider,
      provider_message_id: providerMessageId,
      failure_reason: null,
    })
    .eq('id', row.id);
}

async function markFailed(
  supabase: SupabaseClient,
  row: QueuedRow,
  reason: string,
): Promise<void> {
  await supabase
    .schema('zameen')
    .from('sms_deliveries')
    .update({
      status: 'failed',
      failure_reason: reason.slice(0, 500),
    })
    .eq('id', row.id);
}

async function processOne(
  supabase: SupabaseClient,
  row: QueuedRow,
): Promise<'sent' | 'failed'> {
  const primary = primaryProvider();
  const { result } = await sendWithRetry(primary, row.recipient_phone, row.body);
  if (result.ok) {
    await markSent(supabase, row, primary, result.providerMessageId);
    return 'sent';
  }
  const fallback = fallbackProvider();
  if (fallback && fallback !== primary) {
    const second = await sendWithRetry(fallback, row.recipient_phone, row.body);
    if (second.result.ok) {
      await markSent(supabase, row, fallback, second.result.providerMessageId);
      return 'sent';
    }
    await markFailed(
      supabase,
      row,
      `primary:${result.status}:${result.message};fallback:${second.result.status}:${second.result.message}`,
    );
    return 'failed';
  }
  await markFailed(supabase, row, `${result.status}:${result.message}`);
  return 'failed';
}

Deno.serve(instrument('sms-dispatcher', async (_req: Request) => {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .schema('zameen')
    .from('sms_deliveries')
    .select('id, recipient_phone, body, body_language, segments, provider, notification_id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return jsonResponse({ error: error.message }, 500);

  const rows = (data ?? []) as QueuedRow[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const outcome = await processOne(supabase, row);
      if (outcome === 'sent') sent += 1;
      else failed += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await markFailed(supabase, row, `dispatcher_error:${message}`);
      failed += 1;
    }
  }

  return jsonResponse({
    recordsProcessed: rows.length,
    sent,
    failed,
  });
}));
