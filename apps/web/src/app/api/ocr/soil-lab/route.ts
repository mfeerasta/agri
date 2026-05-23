import { NextResponse } from 'next/server';
import { extractSoilLabReport } from '@zameen/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { imageUrl?: string };
  try {
    body = (await req.json()) as { imageUrl?: string };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  if (!body.imageUrl || typeof body.imageUrl !== 'string') {
    return NextResponse.json({ error: 'missing-image-url' }, { status: 400 });
  }
  const result = await extractSoilLabReport(body.imageUrl);
  return NextResponse.json(result);
}
