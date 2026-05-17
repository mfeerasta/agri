import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Wake-up signal from the service worker Background Sync API.
// The actual queue drain runs on the client (IndexedDB is not accessible
// from the server). This endpoint exists so the SW can mark the sync as
// satisfied. The connected client tabs receive the sync event separately
// and call `drainNow()` from offline-queue.
export function POST(): NextResponse {
  return NextResponse.json({ ok: true, ts: Date.now() }, { headers: { 'cache-control': 'no-store' } });
}
