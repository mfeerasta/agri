// ocr-extractor
// Invoked by Postgres trigger via pg_net when a diesel_purchase or repair_quote
// row is inserted/updated with photos but without an OCR marker. Pulls the
// first receipt photo, runs GPT-4o vision, and fills null columns + sets
// payload->>'ocrExtractedAt' so we never re-run for the same row.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const VISION_MODEL = 'gpt-4o';
const TIMEOUT_MS = 30_000;

interface RequestBody {
  table: 'diesel_purchases' | 'repair_quotes';
  recordId: string;
}

const DIESEL_SYSTEM = [
  'You extract structured fields from photos of Pakistani diesel pump receipts.',
  'Receipts may be in Urdu, Roman Urdu, or English. Numbers are in PKR.',
  'Return strict JSON only: { "vendorName": string|null, "vendorLocation": string|null,',
  '"purchasedAt": string|null, "quantityLiters": number|null, "rateLiterPkr": number|null,',
  '"totalPkr": number|null, "paymentMethod": "cash"|"credit"|"card"|"fuel_card"|null,',
  '"receiptNumber": string|null, "confidence": number, "rawText": string }.',
].join('\n');

const REPAIR_SYSTEM = [
  'You extract structured fields from photos of Pakistani workshop repair quotes.',
  'Usually handwritten Urdu or Roman Urdu on paper. Numbers in PKR.',
  'Return strict JSON only: { "workshopName": string|null, "workshopContact": string|null,',
  '"partsList": Array<{name:string,qty:number,unitPricePkr:number}>|null,',
  '"laborTotalPkr": number|null, "totalQuotePkr": number|null, "etaDays": number|null,',
  '"warrantyDays": number|null, "confidence": number, "rawText": string }.',
].join('\n');

async function callOpenAi(systemPrompt: string, imageUrl: string): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract fields. Output JSON only.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(instrument('ocr-extractor', async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body || !body.table || !body.recordId) {
    return jsonResponse({ error: 'invalid body' }, 400);
  }

  const supabase = getServiceClient();

  if (body.table === 'diesel_purchases') {
    const { data: row, error } = await supabase
      .from('diesel_purchases')
      .select('id, receipt_photo_urls, vendor_name, vendor_location, quantity_liters, rate_liter_pkr, total_pkr, payment_method, notes')
      .eq('id', body.recordId)
      .maybeSingle();
    if (error || !row) return jsonResponse({ error: error?.message ?? 'not found' }, 404);
    const urls = (row.receipt_photo_urls ?? []) as string[];
    if (urls.length === 0) return jsonResponse({ skipped: 'no photos' });

    const extract = await callOpenAi(DIESEL_SYSTEM, urls[0]);
    if (!extract) return jsonResponse({ skipped: 'ocr failed' });

    const confidence = typeof extract.confidence === 'number' ? extract.confidence : 0;
    const patch: Record<string, unknown> = {};
    if (confidence >= 0.5) {
      if (!row.vendor_name && extract.vendorName) patch.vendor_name = extract.vendorName;
      if (!row.vendor_location && extract.vendorLocation) patch.vendor_location = extract.vendorLocation;
      if ((!row.quantity_liters || Number(row.quantity_liters) === 0) && extract.quantityLiters) patch.quantity_liters = extract.quantityLiters;
      if ((!row.rate_liter_pkr || Number(row.rate_liter_pkr) === 0) && extract.rateLiterPkr) patch.rate_liter_pkr = extract.rateLiterPkr;
      if ((!row.total_pkr || Number(row.total_pkr) === 0) && extract.totalPkr) patch.total_pkr = extract.totalPkr;
      if (extract.paymentMethod && ['cash', 'credit', 'card', 'fuel_card'].includes(extract.paymentMethod as string)) {
        patch.payment_method = extract.paymentMethod;
      }
    }
    patch.notes = [row.notes ?? '', `[ocr ${new Date().toISOString()} conf=${confidence.toFixed(2)}] ${String(extract.rawText ?? '')}`]
      .filter(Boolean)
      .join('\n');
    const { error: upd } = await supabase.from('diesel_purchases').update(patch).eq('id', body.recordId);
    if (upd) return jsonResponse({ error: upd.message }, 500);
    return jsonResponse({ ok: true, confidence, filled: Object.keys(patch) });
  }

  // repair_quotes
  const { data: row, error } = await supabase
    .from('repair_quotes')
    .select('id, quote_document_urls, workshop_name, workshop_contact, parts_list, parts_total_pkr, labor_total_pkr, total_quote_pkr, eta_days, warranty_days, ocr_extracted_text')
    .eq('id', body.recordId)
    .maybeSingle();
  if (error || !row) return jsonResponse({ error: error?.message ?? 'not found' }, 404);
  const urls = (row.quote_document_urls ?? []) as string[];
  if (urls.length === 0) return jsonResponse({ skipped: 'no photos' });

  const extract = await callOpenAi(REPAIR_SYSTEM, urls[0]);
  if (!extract) return jsonResponse({ skipped: 'ocr failed' });

  const confidence = typeof extract.confidence === 'number' ? extract.confidence : 0;
  const patch: Record<string, unknown> = {
    ocr_extracted_text: String(extract.rawText ?? row.ocr_extracted_text ?? ''),
  };
  if (confidence >= 0.5) {
    if (!row.workshop_name && extract.workshopName) patch.workshop_name = extract.workshopName;
    if (!row.workshop_contact && extract.workshopContact) patch.workshop_contact = extract.workshopContact;
    if ((!row.labor_total_pkr || Number(row.labor_total_pkr) === 0) && extract.laborTotalPkr) patch.labor_total_pkr = extract.laborTotalPkr;
    if ((!row.total_quote_pkr || Number(row.total_quote_pkr) === 0) && extract.totalQuotePkr) patch.total_quote_pkr = extract.totalQuotePkr;
    if (!row.eta_days && extract.etaDays) patch.eta_days = extract.etaDays;
    if (!row.warranty_days && extract.warrantyDays) patch.warranty_days = extract.warrantyDays;
    if (Array.isArray(extract.partsList) && (!row.parts_list || (row.parts_list as unknown[]).length === 0)) {
      patch.parts_list = extract.partsList;
    }
  }
  const { error: upd } = await supabase.from('repair_quotes').update(patch).eq('id', body.recordId);
  if (upd) return jsonResponse({ error: upd.message }, 500);
  return jsonResponse({ ok: true, confidence, filled: Object.keys(patch) });
}));
