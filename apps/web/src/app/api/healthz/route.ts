import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Kubernetes/Docker liveness probe. Returns 200 if the process can serve
 * traffic. Does not check downstream dependencies — use /api/readyz for
 * readiness gating.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      app: 'web',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? 'dev',
      ts: Date.now(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
