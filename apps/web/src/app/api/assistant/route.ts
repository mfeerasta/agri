import { NextResponse } from 'next/server';
import { sendAssistantMessage } from '@/modules/assistant/actions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const result = await sendAssistantMessage(body);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
