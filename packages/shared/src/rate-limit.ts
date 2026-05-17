/**
 * Cross-process rate limiter backed by `zameen.rate_limit_buckets`. Survives
 * Node process restarts and multiple PM2 workers on the Hetzner VPS.
 *
 * Algorithm: fixed window. Each (key, windowStart) tuple gets a row whose
 * counter is bumped atomically via `INSERT ... ON CONFLICT DO UPDATE`.
 *
 * The DB row carries `expires_at`; a nightly job (or any reader) deletes
 * expired rows opportunistically.
 *
 * Falls back to an in-memory bucket when DATABASE_URL is unset so unit
 * tests + local dev keep working without hitting Postgres.
 */

import { sql as drizzleSql } from 'drizzle-orm';

interface ConsumeArgs {
  key: string;
  limit: number;
  windowMs: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();

function consumeMemory({ key, limit, windowMs }: ConsumeArgs): ConsumeResult {
  const now = Date.now();
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

// Lazy import of db so non-Node consumers (edge / tests) work fine.
type DbClient = {
  execute: (q: ReturnType<typeof drizzleSql>) => Promise<{ rows?: Array<{ count: number }> }>;
};

let cachedDb: DbClient | null | undefined;

async function getDb(): Promise<DbClient | null> {
  if (cachedDb !== undefined) return cachedDb;
  if (!process.env.DATABASE_URL) {
    cachedDb = null;
    return null;
  }
  try {
    const mod = (await import('@zameen/db')) as unknown as { db: DbClient };
    cachedDb = mod.db ?? null;
  } catch {
    cachedDb = null;
  }
  return cachedDb;
}

export async function consume(args: ConsumeArgs): Promise<ConsumeResult> {
  const db = await getDb();
  if (!db) return consumeMemory(args);
  const now = Date.now();
  const windowStart = Math.floor(now / args.windowMs) * args.windowMs;
  const expiresAt = new Date(windowStart + args.windowMs);
  try {
    const result = await db.execute(drizzleSql`
      insert into zameen.rate_limit_buckets (bucket_key, window_start, count, expires_at)
      values (${args.key}, to_timestamp(${windowStart / 1000}), 1, ${expiresAt})
      on conflict (bucket_key, window_start)
      do update set count = zameen.rate_limit_buckets.count + 1
      returning count
    `);
    const count = result.rows?.[0]?.count ?? 1;
    if (count > args.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: expiresAt.getTime() - now };
    }
    return { allowed: true, remaining: Math.max(0, args.limit - count), retryAfterMs: 0 };
  } catch (error) {
    console.warn('[rate-limit] falling back to memory bucket', error);
    return consumeMemory(args);
  }
}

/**
 * Backwards-compatible synchronous wrapper that mirrors the legacy
 * `rateLimit(key, limit, windowMs)` shape from `apps/web/src/lib/rate-limit.ts`.
 * Always uses the in-memory bucket. Prefer `consume()` for new code.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const out = consumeMemory({ key, limit, windowMs });
  return {
    allowed: out.allowed,
    remaining: out.remaining,
    resetAt: Date.now() + (out.retryAfterMs || windowMs),
  };
}
