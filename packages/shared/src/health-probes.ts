/**
 * Lightweight liveness probes for the /admin/status dashboard.
 * Each probe is HEAD/GET small, 5s timeout, never throws. Results are
 * meant to be cached for ~60s upstream.
 */

export interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const TIMEOUT_MS = 5000;

async function timedFetch(url: string, init?: RequestInit): Promise<ProbeResult> {
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const latencyMs = Date.now() - started;
    if (!res.ok) return { ok: false, latencyMs, error: `http ${res.status}` };
    return { ok: true, latencyMs };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeDatabase(): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const mod = (await import('@zameen/db')) as { sql: (s: TemplateStringsArray) => Promise<unknown> };
    await mod.sql`select 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : 'db error',
    };
  }
}

export async function probeR2(): Promise<ProbeResult> {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
  if (!base) return { ok: false, latencyMs: 0, error: 'not configured' };
  return timedFetch(base, { method: 'HEAD' });
}

export async function probeMapbox(): Promise<ProbeResult> {
  const token = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return { ok: false, latencyMs: 0, error: 'not configured' };
  return timedFetch(`https://api.mapbox.com/?access_token=${token}`, { method: 'GET' });
}

export async function probeAnthropic(): Promise<ProbeResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, latencyMs: 0, error: 'not configured' };
  return timedFetch('https://api.anthropic.com/', { method: 'GET' });
}

export async function probeOpenAI(): Promise<ProbeResult> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, latencyMs: 0, error: 'not configured' };
  return timedFetch('https://api.openai.com/', { method: 'GET' });
}

export async function probeWhatsApp(): Promise<ProbeResult> {
  if (!process.env.WHATSAPP_API_TOKEN) return { ok: false, latencyMs: 0, error: 'not configured' };
  return timedFetch('https://graph.facebook.com/v18.0/', { method: 'GET' });
}

export async function probeEmail(): Promise<ProbeResult> {
  if (!process.env.RESEND_API_KEY) return { ok: false, latencyMs: 0, error: 'not configured' };
  return timedFetch('https://api.resend.com/', { method: 'GET' });
}

export async function probePush(): Promise<ProbeResult> {
  if (!process.env.VAPID_PRIVATE_KEY) return { ok: false, latencyMs: 0, error: 'not configured' };
  return { ok: true, latencyMs: 0 };
}
