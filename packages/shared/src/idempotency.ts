/**
 * Generic idempotency wrapper for bespoke POST/PUT/DELETE routes.
 *
 * Pattern: client sends `Idempotency-Key: <uuid>` per logical operation.
 * If we have already executed under that key, replay the cached response.
 * Otherwise execute the handler and stash the result for the TTL window.
 *
 * Server actions are CSRF-protected and re-entrant by virtue of the Next.js
 * framework, so they do NOT need to use this wrapper. Use it on REST-style
 * routes (file uploads, AI calls, push subscribe, diagnostics, OCR) where
 * a network blip can cause an honest retry.
 */
import { sql as drizzleSql } from 'drizzle-orm';

export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export interface IdempotencyResult<T> {
  ok: true;
  data: T;
  cached: boolean;
}

interface RunArgs<T> {
  key: string;
  userId?: string;
  requestHash?: string;
  ttlSeconds?: number;
  handler: () => Promise<T>;
}

type DbClient = {
  execute: (q: ReturnType<typeof drizzleSql>) => Promise<{ rows?: Array<{ response?: T }> }>;
};

let cachedDb: unknown | null | undefined;

async function getDb(): Promise<{ execute: DbClient['execute'] } | null> {
  if (cachedDb !== undefined) return cachedDb as { execute: DbClient['execute'] } | null;
  if (!process.env.DATABASE_URL) {
    cachedDb = null;
    return null;
  }
  try {
    const mod = (await import('@zameen/db')) as unknown as {
      db: { execute: DbClient['execute'] };
    };
    cachedDb = mod.db ?? null;
  } catch {
    cachedDb = null;
  }
  return cachedDb as { execute: DbClient['execute'] } | null;
}

/**
 * Run `handler` at most once per `key`. On a duplicate call return the
 * previously stored response (`cached: true`). Failed handlers do NOT
 * cache so the client can retry on a transient error.
 *
 * The TTL is enforced by an opportunistic cleanup query rather than a
 * Postgres TTL, so callers can pass any window.
 */
export async function withIdempotency<T>(args: RunArgs<T>): Promise<IdempotencyResult<T>> {
  const { key, userId, requestHash, ttlSeconds = 86400, handler } = args;
  const db = await getDb();
  if (!db) {
    const data = await handler();
    return { ok: true, data, cached: false };
  }

  const lookup = await db.execute(drizzleSql`
    select response from zameen.idempotency_log
    where idempotency_key = ${key}
      and created_at > now() - (${ttlSeconds} || ' seconds')::interval
    limit 1
  `);
  const cached = lookup.rows?.[0]?.response as T | undefined;
  if (cached !== undefined && cached !== null) {
    return { ok: true, data: cached, cached: true };
  }

  const data = await handler();

  await db.execute(drizzleSql`
    insert into zameen.idempotency_log (idempotency_key, user_id, request_hash, response)
    values (${key}, ${userId ?? null}, ${requestHash ?? null}, ${JSON.stringify(data)}::jsonb)
    on conflict (idempotency_key) do nothing
  `);

  return { ok: true, data, cached: false };
}

/**
 * Helper for route handlers: read the idempotency key from request headers.
 * Accepts both common header casings.
 */
export function readIdempotencyKey(req: Request): string | undefined {
  return (
    req.headers.get(IDEMPOTENCY_HEADER) ??
    req.headers.get('idempotency-key') ??
    undefined
  );
}
