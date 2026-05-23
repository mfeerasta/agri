import { NextResponse } from 'next/server';
import { db, soilHealthCards } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { computeRecommendation, CROP_BASELINES } from '@zameen/finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ cardId: string }>;
}

// Generates a minimal printable HTML "PDF". Browser print-to-PDF preserves the
// bilingual layout. Replaced with a server-rendered PDF once the print-engine
// package lands in Phase 2.
export async function GET(req: Request, { params }: Params) {
  const { cardId } = await params;
  const url = new URL(req.url);
  const cropCode = url.searchParams.get('crop') ?? 'wheat';
  const targetYield = Number(
    url.searchParams.get('yield') ?? CROP_BASELINES[cropCode]?.baselineTargetYieldKgPerAcre ?? 1600,
  );

  const [card] = await db
    .select()
    .from(soilHealthCards)
    .where(eq(soilHealthCards.id, cardId))
    .limit(1);
  if (!card) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const rec = await computeRecommendation({ cardId, cropCode, targetYieldKgPerAcre: targetYield });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Fertilizer plan ${card.cardNumber}</title>
<style>
 body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
 h1 { margin: 0 0 8px; }
 .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
 .row { padding: 4px 0; border-bottom: 1px solid #eee; }
 .label { color: #555; font-size: 11px; text-transform: uppercase; }
 .value { font-size: 16px; font-weight: 600; }
 .ur { direction: rtl; font-size: 14px; color: #333; margin-top: 12px; }
 @media print { body { margin: 0.5in; } }
</style>
</head>
<body>
<h1>Fertilizer recommendation</h1>
<div>Card ${card.cardNumber}, issued ${card.issuedOn}.</div>
<div>Crop: ${CROP_BASELINES[cropCode]?.cropName ?? cropCode} | Target yield: ${targetYield} kg/acre</div>
<hr />
<div class="grid">
  <div class="row"><div class="label">Nitrogen (N)</div><div class="value">${rec.nKgPerAcre} kg/acre</div></div>
  <div class="row"><div class="label">Phosphate (P2O5)</div><div class="value">${rec.p2o5KgPerAcre} kg/acre</div></div>
  <div class="row"><div class="label">Potash (K2O)</div><div class="value">${rec.k2oKgPerAcre} kg/acre</div></div>
  <div class="row"><div class="label">Zinc</div><div class="value">${rec.zincKgPerAcre ?? '-'} kg/acre</div></div>
  <div class="row"><div class="label">Sulphur</div><div class="value">${rec.sulphurKgPerAcre ?? '-'} kg/acre</div></div>
</div>
${
  rec.organicRecommendations
    ? `<h2>Organic amendments</h2><p>${rec.organicRecommendations.replaceAll('\n', '<br />')}</p>`
    : ''
}
<h2>Rationale</h2>
<p>${rec.aiRationaleEn}</p>
<p class="ur">${rec.aiRationaleUr}</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `inline; filename="fertilizer-plan-${card.cardNumber}.html"`,
    },
  });
}
