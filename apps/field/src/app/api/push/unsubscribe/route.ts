import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, pushSubscriptions } from '@zameen/db';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body.endpoint || typeof body.endpoint !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, data.user.id),
        eq(pushSubscriptions.endpoint, body.endpoint),
      ),
    );
  return NextResponse.json({ ok: true });
}
