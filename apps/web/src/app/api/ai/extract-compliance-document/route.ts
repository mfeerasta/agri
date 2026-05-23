/**
 * POST /api/ai/extract-compliance-document
 *
 * Given a publicly-accessible URL of a compliance document (PDF or image),
 * call Claude vision to extract structured fields: docKind, title,
 * referenceNumber, issuingAuthority, issuedOn, expiresOn.
 *
 * Returns best-effort JSON; missing fields are left undefined and the human
 * reviews/corrects before saving. No DB writes here.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { stream } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { assertSameOrigin, CsrfError } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  url: z.string().url().max(2000),
});

const KIND_HINTS = [
  'land_record_fard', 'khasra_girdawari', 'registry_deed', 'intiqal', 'mutation',
  'water_rate_receipt', 'abiana_bill', 'electricity_subsidy_certificate',
  'kissan_card', 'crop_loan_agreement', 'crop_insurance_policy',
  'plant_health_certificate', 'export_phytosanitary', 'pesticide_dealer_license',
  'tractor_registration', 'driver_license', 'nadra_cnic', 'passport',
  'ntn_certificate', 'strn_certificate', 'lease_deed', 'partnership_deed',
  'board_resolution', 'power_of_attorney', 'other',
] as const;

const SYSTEM = `You are an OCR + extraction assistant for Pakistani compliance documents.
Given a document image, extract these fields if visible:
- docKind: one of [${KIND_HINTS.join(', ')}]
- title: short descriptive title
- referenceNumber: any registration/reference/CNIC/serial number on the document
- issuingAuthority: name of the office, department, or government body that issued it
- issuedOn: YYYY-MM-DD if a clear issuance date is visible
- expiresOn: YYYY-MM-DD if a clear expiry/validity date is visible

Pakistan-specific tips:
- 'Fard' or 'Misal Hakkiyat' -> land_record_fard
- 'Intiqal' / 'Mutation' -> intiqal or mutation
- CNIC -> nadra_cnic, format 5-7-1 numeric (e.g. 35202-1234567-1)
- 'Kissan Card' or 'Bank of Punjab' agri card -> kissan_card
- Tractor RC -> tractor_registration

Respond with ONLY valid JSON, no prose. Use null for fields you cannot extract.`;

export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const limit = rateLimit(`ai-extract:${session.userId}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  let full = '';
  try {
    for await (const chunk of stream({
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Document URL: ${parsed.data.url}\n\nExtract the fields as JSON.`,
        },
      ],
      maxTokens: 600,
      temperature: 0,
    })) {
      if (chunk.delta) full += chunk.delta;
    }
  } catch (e) {
    return NextResponse.json({ error: 'extraction failed', detail: String(e) }, { status: 502 });
  }

  // Robust JSON parse - take first {...} block.
  const match = full.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({});
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    return NextResponse.json({
      docKind: typeof obj.docKind === 'string' ? obj.docKind : undefined,
      title: typeof obj.title === 'string' ? obj.title : undefined,
      referenceNumber: typeof obj.referenceNumber === 'string' ? obj.referenceNumber : undefined,
      issuingAuthority: typeof obj.issuingAuthority === 'string' ? obj.issuingAuthority : undefined,
      issuedOn: typeof obj.issuedOn === 'string' ? obj.issuedOn : undefined,
      expiresOn: typeof obj.expiresOn === 'string' ? obj.expiresOn : undefined,
    });
  } catch {
    return NextResponse.json({});
  }
}
