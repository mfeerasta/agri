import { NextResponse } from 'next/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server/script/deps';
import { verifyAuthentication } from '../../../../../lib/webauthn';
import { createSupabaseServiceAuthClient } from '../../../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as AuthenticationResponseJSON;
  const result = await verifyAuthentication(body);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  // Mint a Supabase session by generating a magiclink for the resolved user,
  // then returning the link's action_link for the client to navigate to.
  // Trade-off documented in docs/decisions.md.
  const admin = createSupabaseServiceAuthClient();
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(result.userId);
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: 'User lookup failed' }, { status: 500 });
  }
  const email = userData.user.email;
  if (!email) {
    return NextResponse.json(
      { ok: false, error: 'User has no email; cannot mint session via magiclink' },
      { status: 500 },
    );
  }
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { ok: false, error: linkErr?.message ?? 'Failed to mint session' },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    redirectTo: linkData.properties.action_link,
  });
}
