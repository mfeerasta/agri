import { NextResponse } from 'next/server';
import { probeDatabase, probeR2, logger, traceIdFromRequest, setTraceId } from '@zameen/shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  const traceId = traceIdFromRequest(req);
  setTraceId(traceId);

  const [database, r2] = await Promise.all([probeDatabase(), probeR2()]);
  const checks = { database, r2 };
  const failures = Object.entries(checks)
    .filter(([, r]) => !r.ok)
    .map(([name, r]) => ({ name, error: r.error ?? 'unknown' }));
  const ok = failures.length === 0;

  if (!ok) logger.warn('readyz', 'readiness failed', { traceId, failures });

  return NextResponse.json(
    {
      ok,
      app: 'field',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? 'dev',
      checks,
      failures,
      ts: Date.now(),
    },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store', 'x-request-id': traceId } },
  );
}
