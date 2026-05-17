import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { generateRegistrationOpts } from '../../../../../lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const user = data.user;
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.phone ?? user.email ?? user.id;
  const phone = user.phone ?? user.email ?? user.id;
  try {
    const options = await generateRegistrationOpts(user.id, name, phone);
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
