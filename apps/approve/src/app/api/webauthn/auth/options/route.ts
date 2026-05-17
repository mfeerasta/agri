import { NextResponse } from 'next/server';
import { generateAuthOpts } from '../../../../../lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  try {
    const options = await generateAuthOpts();
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
