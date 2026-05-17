import { NextResponse } from 'next/server';
import { db, jobRuns } from '@zameen/db';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let failedLast24h = 0;
  const lastSuccessAt: Record<string, string> = {};

  try {
    const failedRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobRuns)
      .where(
        and(
          gte(jobRuns.startedAt, since24h),
          sql`${jobRuns.status} in ('failed','timed_out')`,
        ),
      );
    failedLast24h = failedRows[0]?.count ?? 0;

    const successRows = await db
      .select({ name: jobRuns.jobName, ts: jobRuns.completedAt })
      .from(jobRuns)
      .where(eq(jobRuns.status, 'succeeded'))
      .orderBy(desc(jobRuns.completedAt))
      .limit(500);

    for (const r of successRows) {
      if (r.ts && !lastSuccessAt[r.name]) {
        lastSuccessAt[r.name] = new Date(r.ts).toISOString();
      }
    }
  } catch {
    // db unavailable; still return ok
  }

  return NextResponse.json(
    {
      ok: true,
      app: 'web',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? 'dev',
      ts: Date.now(),
      jobs: { failedLast24h, lastSuccessAt },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
