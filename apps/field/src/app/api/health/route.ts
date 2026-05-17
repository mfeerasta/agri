import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      app: 'field',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? 'dev',
      ts: Date.now(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
