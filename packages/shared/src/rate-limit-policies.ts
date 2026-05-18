/**
 * Per-route rate-limit policy table. Lives in @zameen/shared so all four
 * Next apps (web, field, ops, approve) and supabase edge functions can
 * import a single source of truth. Override per-app by extending in a
 * local rate-limits.ts if needed.
 */
import { consume } from './rate-limit.js';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  default: { limit: 60, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 60 * 60_000 },
  diagnostics: { limit: 20, windowMs: 60 * 60_000 },
  ocr: { limit: 10, windowMs: 60_000 },
  health: { limit: 600, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
  marketing: { limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitKind = keyof typeof RATE_LIMITS;

export async function withRateLimit(
  kind: RateLimitKind,
  identity: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const cfg = RATE_LIMITS[kind];
  const result = await consume({
    key: `${kind}:${identity}`,
    limit: cfg.limit,
    windowMs: cfg.windowMs,
  });
  if (!result.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    return new Response(
      JSON.stringify({ error: 'rate_limited', retryAfterSec }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(retryAfterSec),
        },
      },
    );
  }
  return handler();
}

export function identityFromRequest(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return `ip:${xf.split(',')[0]!.trim()}`;
  const real = req.headers.get('x-real-ip');
  if (real) return `ip:${real}`;
  return 'anon';
}
