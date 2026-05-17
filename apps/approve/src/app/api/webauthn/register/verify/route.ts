import { NextResponse } from 'next/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server/script/deps';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { verifyRegistration } from '../../../../../lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  response: RegistrationResponseJSON;
  deviceLabel?: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const body = (await req.json()) as Body | RegistrationResponseJSON;
  const isWrapped = (b: unknown): b is Body =>
    typeof b === 'object' && b !== null && 'response' in (b as Record<string, unknown>) &&
    typeof (b as { response?: unknown }).response === 'object';
  const response = isWrapped(body) ? body.response : (body as RegistrationResponseJSON);
  const deviceLabel = isWrapped(body) ? body.deviceLabel : undefined;

  const result = await verifyRegistration(data.user.id, response, deviceLabel);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, credentialId: result.credentialId });
}
