import { NextResponse } from 'next/server';
import { db, pushSubscriptions } from '@zameen/db';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceLabel?: string;
}

function isSubscribeBody(v: unknown): v is SubscribeBody {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.endpoint === 'string'
    && o.endpoint.length > 0
    && typeof o.keys === 'object'
    && o.keys !== null
    && typeof (o.keys as { p256dh?: unknown }).p256dh === 'string'
    && typeof (o.keys as { auth?: unknown }).auth === 'string';
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!isSubscribeBody(body)) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const userAgent = req.headers.get('user-agent') ?? null;
  try {
    await db
      .insert(pushSubscriptions)
      .values({
        userId: data.user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
        deviceLabel: body.deviceLabel ?? null,
        app: 'ops',
        lastUsedAt: new Date(),
        failureCount: 0,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
        set: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent,
          deviceLabel: body.deviceLabel ?? null,
          app: 'ops',
          lastUsedAt: new Date(),
          failureCount: 0,
        },
      });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'insert_failed' },
      { status: 500 },
    );
  }
}
