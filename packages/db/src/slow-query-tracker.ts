/**
 * Slow query tracker. Wraps db.execute() (and any caller-supplied runner)
 * and logs queries that exceed the threshold to zameen.slow_queries.
 *
 * The SQL text is sanitized before persistence: string literals collapsed,
 * numeric literals collapsed, and consecutive whitespace squashed so that
 * we group similar queries together when surfacing on /admin/status.
 *
 * Recursive logging is avoided by tagging the insert itself as internal.
 */

import { sql as drizzleSql } from 'drizzle-orm';
import { db } from './index.js';

const DEFAULT_THRESHOLD_MS = 250;

function readThreshold(): number {
  const raw = process.env.ZAMEEN_SLOW_QUERY_THRESHOLD_MS;
  if (!raw) return DEFAULT_THRESHOLD_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD_MS;
}

export function sanitizeSql(input: string): string {
  let out = input;
  out = out.replace(/'([^'\\]|\\.)*'/g, "'?'");
  out = out.replace(/\b\d+(?:\.\d+)?\b/g, '?');
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > 2000) out = `${out.slice(0, 2000)}...`;
  return out;
}

function callerFromStack(): string | null {
  const err = new Error();
  const stack = err.stack?.split('\n').slice(3) ?? [];
  for (const line of stack) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes('slow-query-tracker')) continue;
    if (trimmed.includes('node_modules')) continue;
    if (trimmed.includes('drizzle-orm')) continue;
    return trimmed.replace(/^at\s+/, '').slice(0, 200);
  }
  return null;
}

let recording = false;

async function recordSlowQuery(sqlText: string, durationMs: number, caller: string | null): Promise<void> {
  if (recording) return;
  recording = true;
  try {
    const sanitized = sanitizeSql(sqlText);
    await db.execute(
      drizzleSql`insert into zameen.slow_queries (sql_text, duration_ms, caller) values (${sanitized}, ${durationMs}, ${caller})`,
    );
  } catch {
    // Best-effort. Never throw from the tracker.
  } finally {
    recording = false;
  }
}

export interface TrackedQueryOptions {
  thresholdMs?: number;
  caller?: string;
  sqlText?: string;
}

/**
 * Run a query and record it if slow. Returns the original result type.
 *
 * Use with db.execute() callbacks or any thunk that runs a query.
 */
export async function trackQuery<T>(
  description: string,
  run: () => Promise<T>,
  options: TrackedQueryOptions = {},
): Promise<T> {
  const threshold = options.thresholdMs ?? readThreshold();
  const start = performance.now();
  try {
    return await run();
  } finally {
    const durationMs = Math.round(performance.now() - start);
    if (durationMs >= threshold) {
      const caller = options.caller ?? callerFromStack();
      const sqlText = options.sqlText ?? description;
      void recordSlowQuery(sqlText, durationMs, caller);
    }
  }
}

/**
 * Drop-in wrapper for db.execute(). Pass the same SQL tag and the wrapper
 * times it and logs if it exceeds the threshold.
 */
export async function executeTracked<T>(
  query: Parameters<typeof db.execute>[0],
  description: string,
): Promise<T> {
  return trackQuery(description, async () => {
    return (await db.execute(query)) as unknown as T;
  });
}

export interface SlowQueryRow {
  id: string;
  sqlText: string;
  durationMs: number;
  caller: string | null;
  occurredAt: Date;
}

export async function listTopSlowQueriesToday(limit = 10): Promise<SlowQueryRow[]> {
  const result = await db.execute<{
    id: string;
    sql_text: string;
    duration_ms: number;
    caller: string | null;
    occurred_at: Date;
  }>(
    drizzleSql`
      select id, sql_text, duration_ms, caller, occurred_at
      from zameen.slow_queries
      where occurred_at >= date_trunc('day', now())
      order by duration_ms desc
      limit ${limit}
    `,
  );
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
  return (rows as Array<{
    id: string;
    sql_text: string;
    duration_ms: number;
    caller: string | null;
    occurred_at: Date;
  }>).map((r) => ({
    id: r.id,
    sqlText: r.sql_text,
    durationMs: r.duration_ms,
    caller: r.caller,
    occurredAt: r.occurred_at,
  }));
}
