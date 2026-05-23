/**
 * SMS gateway for workers who don't have WhatsApp.
 *
 * Punjab field workers often carry basic feature phones. SMS reaches every
 * GSM handset with no data plan and no install required. We route through
 * Twilio as the primary global provider and fall back to PTCL's local
 * SMS HTTP API for cost-controlled domestic-only sends.
 *
 * Encoding: GSM-7 fits 160 chars/segment, UCS-2 (any Urdu Nastaliq) fits
 * only 70. If the recipient prefers Roman Urdu we transliterate so each
 * segment stays at 160. Long bodies are auto-split by the carrier; we
 * compute the segment count up front so callers can budget cost.
 */

import {
  smsEncoding,
  smsSegmentCount,
  urduToRoman,
} from './transliterate.js';

export type SmsLocale = 'en' | 'ur' | 'roman_ur' | 'pa' | 'hi';

export type SmsProvider = 'twilio' | 'ptcl' | 'jazz' | 'easypaisa';

export interface SendSmsInput {
  to: string;
  body: string;
  locale?: SmsLocale;
  /**
   * If true and the body is Urdu Nastaliq, transliterate to Roman Urdu
   * before encoding. Recipients on basic phones should set this.
   */
  preferRomanForBasicPhone?: boolean;
  /** Override provider selection; default uses SMS_PROVIDER env. */
  provider?: SmsProvider;
}

export interface SendSmsResult {
  provider: SmsProvider;
  providerMessageId: string;
  segments: number;
  encoding: 'gsm-7' | 'ucs-2';
  /** Estimated cost in PKR for budget tracking. */
  estimatedCostPkr: number;
  /** The body that was actually sent after transliteration. */
  bodySent: string;
  bodyLanguage: SmsLocale;
}

export class SmsError extends Error {
  constructor(
    public statusCode: number,
    public provider: SmsProvider | 'unknown',
    public retriable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'SmsError';
  }
}

const SEND_TIMEOUT_MS = 30000;
const RETRY_BACKOFF_MS = [1000, 5000, 30000];
const MAX_RETRIES = 3;

/**
 * Estimated per-segment cost in PKR. These are board figures used for
 * budgeting only; actuals are reconciled from the provider invoice.
 * Numbers are conservative ceilings.
 */
const COST_PKR_PER_SEGMENT: Record<SmsProvider, number> = {
  twilio: 14.5,
  ptcl: 1.2,
  jazz: 1.5,
  easypaisa: 1.5,
};

function pickProvider(override?: SmsProvider): SmsProvider {
  if (override) return override;
  const env = (
    typeof process !== 'undefined' ? process.env.SMS_PROVIDER : undefined
  ) as SmsProvider | undefined;
  return env ?? 'twilio';
}

function pickFallbackProvider(): SmsProvider | null {
  const env = (
    typeof process !== 'undefined' ? process.env.SMS_FALLBACK_PROVIDER : undefined
  ) as SmsProvider | undefined;
  return env ?? null;
}

/**
 * Normalise a phone number to E.164. Accepts the common Pakistani
 * formats (03xx-xxxxxxx, +923xx..., 923xx...). Returns null when the
 * shape is unrecognised so callers can bail out cleanly.
 */
export function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  return null;
}

async function postWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaTwilio(to: string, body: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new SmsError(0, 'twilio', false, 'twilio env vars not set');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const form = new URLSearchParams({ To: to, From: from, Body: body });
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
    code?: number;
    message?: string;
  };
  if (!res.ok) {
    const retriable = res.status === 429 || res.status >= 500;
    throw new SmsError(
      res.status,
      'twilio',
      retriable,
      json.message ?? `twilio http ${res.status}`,
    );
  }
  return json.sid ?? '';
}

async function sendViaPtcl(to: string, body: string): Promise<string> {
  const user = process.env.PTCL_SMS_USERNAME;
  const pass = process.env.PTCL_SMS_PASSWORD;
  if (!user || !pass) {
    throw new SmsError(0, 'ptcl', false, 'ptcl env vars not set');
  }
  // PTCL Ufone Branchless / corporate SMS gateway uses a simple HTTPS GET.
  const url = new URL('https://sms.ptcl.com.pk/api/send');
  url.searchParams.set('username', user);
  url.searchParams.set('password', pass);
  url.searchParams.set('to', to);
  url.searchParams.set('text', body);
  const res = await postWithTimeout(url.toString(), { method: 'GET' });
  const text = await res.text();
  if (!res.ok) {
    throw new SmsError(
      res.status,
      'ptcl',
      res.status >= 500,
      `ptcl http ${res.status}`,
    );
  }
  // Provider returns plain "OK <id>" or "ERR <reason>".
  if (text.startsWith('ERR')) {
    throw new SmsError(502, 'ptcl', false, text);
  }
  const match = text.match(/OK\s+(\S+)/);
  return match ? match[1] : '';
}

async function sendOnce(
  provider: SmsProvider,
  to: string,
  body: string,
): Promise<string> {
  switch (provider) {
    case 'twilio':
      return sendViaTwilio(to, body);
    case 'ptcl':
    case 'jazz':
    case 'easypaisa':
      // Jazz Cash and Easypaisa expose PTCL-shaped HTTP APIs we route to the
      // same handler. If the contract diverges later we split them out.
      return sendViaPtcl(to, body);
  }
}

async function sendWithRetry(
  provider: SmsProvider,
  to: string,
  body: string,
): Promise<{ providerMessageId: string; attempts: number }> {
  let attempt = 0;
  let lastErr: SmsError | undefined;
  while (attempt < MAX_RETRIES) {
    try {
      const id = await sendOnce(provider, to, body);
      return { providerMessageId: id, attempts: attempt + 1 };
    } catch (e) {
      lastErr = e instanceof SmsError ? e : new SmsError(0, provider, true, String(e));
      attempt += 1;
      if (!lastErr.retriable || attempt >= MAX_RETRIES) break;
      const backoff = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr ?? new SmsError(0, provider, false, 'sms send failed');
}

/**
 * Send an SMS. Auto-transliterates Urdu Nastaliq to Roman Urdu when the
 * caller flags the recipient as a basic-phone user, computes segment
 * count and estimated PKR cost, retries on 429 / 5xx with exponential
 * backoff, and falls through to the configured fallback provider on a
 * non-retriable primary failure.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const to = normalisePhone(input.to);
  if (!to) throw new SmsError(400, 'unknown', false, `invalid phone: ${input.to}`);

  let bodySent = input.body;
  let bodyLanguage: SmsLocale = input.locale ?? 'en';

  if (
    input.preferRomanForBasicPhone &&
    (bodyLanguage === 'ur' || bodyLanguage === 'pa')
  ) {
    bodySent = urduToRoman(bodySent);
    bodyLanguage = 'roman_ur';
  }

  const { segments, encoding } = smsSegmentCount(bodySent);
  const primary = pickProvider(input.provider);

  try {
    const { providerMessageId } = await sendWithRetry(primary, to, bodySent);
    return {
      provider: primary,
      providerMessageId,
      segments,
      encoding,
      estimatedCostPkr: segments * COST_PKR_PER_SEGMENT[primary],
      bodySent,
      bodyLanguage,
    };
  } catch (primaryErr) {
    const fallback = pickFallbackProvider();
    if (!fallback || fallback === primary) throw primaryErr;
    const { providerMessageId } = await sendWithRetry(fallback, to, bodySent);
    return {
      provider: fallback,
      providerMessageId,
      segments,
      encoding,
      estimatedCostPkr: segments * COST_PKR_PER_SEGMENT[fallback],
      bodySent,
      bodyLanguage,
    };
  }
}

/**
 * Pure cost estimator for budget reporting and pre-send affordability
 * checks. Does not perform any network call.
 */
export function estimateSmsCostPkr(
  body: string,
  provider: SmsProvider = pickProvider(),
): { segments: number; encoding: 'gsm-7' | 'ucs-2'; costPkr: number } {
  const { segments, encoding } = smsSegmentCount(body);
  return {
    segments,
    encoding,
    costPkr: segments * COST_PKR_PER_SEGMENT[provider],
  };
}

export { smsEncoding };
