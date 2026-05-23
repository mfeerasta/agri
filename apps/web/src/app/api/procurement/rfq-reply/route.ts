import { NextResponse } from 'next/server';
import { db, rfqInvitations, rfqs } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { submitRfqQuoteByToken } from '@/modules/procurement/rfq-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  if (!token) return NextResponse.json({ ok: false, error: 'missing token' }, { status: 400 });
  const [inv] = await db
    .select()
    .from(rfqInvitations)
    .where(eq(rfqInvitations.replyToken, token))
    .limit(1);
  if (!inv) return NextResponse.json({ ok: false, error: 'invalid token' }, { status: 404 });
  const [rfqRow] = await db.select().from(rfqs).where(eq(rfqs.id, inv.rfqId)).limit(1);
  return NextResponse.json({
    ok: true,
    rfq: rfqRow
      ? { id: rfqRow.id, number: rfqRow.rfqNumber, title: rfqRow.title, status: rfqRow.status }
      : null,
    vendorId: inv.vendorId,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('t') ?? '';
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const result = await submitRfqQuoteByToken({ ...body, replyToken: token });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
