/**
 * POST /api/feasibility/draft
 *
 * Calls Claude via @zameen/shared generateFeasibilityDraft to produce
 * a structured feasibility study draft from a short brief. The output
 * is intentionally a starter, not the final document. The user edits
 * it on the New Feasibility form, then submits for Director approval.
 *
 * Returns { draft } on success, { error } on validation or LLM failure.
 */

import { NextResponse } from 'next/server';
import { feasibilityDraftRequestSchema, generateFeasibilityDraft } from '@zameen/shared';
import { getSessionContext } from '../../../../lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request): Promise<NextResponse> {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = feasibilityDraftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const draft = await generateFeasibilityDraft({
    title: parsed.data.title,
    type: parsed.data.type,
    briefDescription: parsed.data.briefDescription,
    fieldContext: parsed.data.fieldIds ? `Linked fields: ${parsed.data.fieldIds.join(', ')}` : undefined,
    capexEstimatePkr: parsed.data.capexEstimatePkr,
    opexEstimatePkr: parsed.data.opexEstimatePkr,
  });

  if (!draft) {
    return NextResponse.json(
      { error: 'AI draft service unavailable. Fill the form manually.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ draft });
}
