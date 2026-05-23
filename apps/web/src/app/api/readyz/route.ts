import { NextResponse } from 'next/server';
import {
  probeDatabase,
  probeR2,
  probeAnthropic,
  logger,
  traceIdFromRequest,
  setTraceId,
  type ProbeResult,
} from '@zameen/shared';
import { db, jobRuns } from '@zameen/db';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CachedResult {
  result: ProbeResult;
  expiresAt: number;
}

const anthropicCache: { v: CachedResult | null } = { v: null };
const CACHE_TTL_MS = 60_000;

async function cachedAnthropic(): Promise<ProbeResult> {
  const now = Date.now();
  if (anthropicCache.v && anthropicCache.v.expiresAt > now) return anthropicCache.v.result;
  const result = await probeAnthropic();
  anthropicCache.v = { result, expiresAt: now + CACHE_TTL_MS };
  return result;
}

async function probeCron(): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const rows = await db
      .select({ completedAt: jobRuns.completedAt })
      .from(jobRuns)
      .orderBy(desc(jobRuns.completedAt))
      .limit(1);
    const latest = rows[0]?.completedAt;
    if (!latest) {
      return { ok: false, latencyMs: Date.now() - started, error: 'no job_runs recorded' };
    }
    const ageMs = Date.now() - new Date(latest).getTime();
    const tenMin = 10 * 60 * 1000;
    if (ageMs > tenMin) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: `last cron run ${Math.round(ageMs / 60_000)}min ago`,
      };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : 'cron probe failed',
    };
  }
}

/**
 * Readiness probe. Returns 200 only when every downstream is reachable.
 * Returns 503 with a JSON body enumerating which checks failed so the
 * orchestrator can choose to evict this pod.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const traceId = traceIdFromRequest(req);
  setTraceId(traceId);

  const [database, r2, anthropic, cron] = await Promise.all([
    probeDatabase(),
    probeR2(),
    cachedAnthropic(),
    probeCron(),
  ]);

  const checks = { database, r2, anthropic, cron };
  const failures = Object.entries(checks)
    .filter(([, r]) => !r.ok)
    .map(([name, r]) => ({ name, error: r.error ?? 'unknown' }));
  const ok = failures.length === 0;

  if (!ok) {
    logger.warn('readyz', 'readiness failed', { traceId, failures });
  }

  return NextResponse.json(
    {
      ok,
      app: 'web',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? 'dev',
      checks,
      failures,
      ts: Date.now(),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'cache-control': 'no-store', 'x-request-id': traceId },
    },
  );
}
