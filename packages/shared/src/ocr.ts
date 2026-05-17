/**
 * OpenAI Vision-backed OCR for diesel receipts and Urdu/Roman-Urdu workshop
 * repair quotes. All extracts are validated through Zod before returning so
 * callers can trust shapes. On failure (timeout, parse error, missing key),
 * extractors return a zero-confidence empty extract rather than throwing, so
 * the form layer can fall back to manual entry without crashing.
 */

import {
  dieselReceiptExtractSchema,
  repairQuoteExtractSchema,
  type DieselReceiptExtract,
  type RepairQuoteExtract,
} from './validators/ocr.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const VISION_MODEL = 'gpt-4o';
const TIMEOUT_MS = 30_000;

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

async function callOpenAi(systemPrompt: string, userText: string, imageUrl: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
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
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as OpenAiChatResponse;
    const content = json.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function safeJsonParse<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function emptyDieselExtract(rawText = ''): DieselReceiptExtract {
  return {
    vendorName: null,
    vendorLocation: null,
    purchasedAt: null,
    quantityLiters: null,
    rateLiterPkr: null,
    totalPkr: null,
    paymentMethod: null,
    receiptNumber: null,
    confidence: 0,
    rawText,
  };
}

function emptyRepairExtract(rawText = ''): RepairQuoteExtract {
  return {
    workshopName: null,
    workshopContact: null,
    partsList: null,
    laborTotalPkr: null,
    totalQuotePkr: null,
    etaDays: null,
    warrantyDays: null,
    confidence: 0,
    rawText,
  };
}

const DIESEL_SYSTEM = [
  'You extract structured fields from photos of Pakistani diesel pump receipts.',
  'Receipts may be in Urdu, Roman Urdu, or English. Numbers are in PKR.',
  'Return strict JSON only matching this schema (no commentary):',
  '{',
  '  "vendorName": string | null,',
  '  "vendorLocation": string | null,',
  '  "purchasedAt": string | null,        // ISO 8601 if you can read date and time',
  '  "quantityLiters": number | null,',
  '  "rateLiterPkr": number | null,',
  '  "totalPkr": number | null,',
  '  "paymentMethod": "cash" | "credit" | "card" | "fuel_card" | null,',
  '  "receiptNumber": string | null,',
  '  "confidence": number,                 // self-assessed 0..1',
  '  "rawText": string                     // verbatim text you read',
  '}',
  'Use null for any field you cannot read with reasonable certainty.',
  'Set confidence honestly: <0.5 if the image is blurry or you guessed multiple fields.',
].join('\n');

const REPAIR_SYSTEM = [
  'You extract structured fields from photos of Pakistani workshop repair quotes.',
  'Quotes are usually handwritten in Urdu or Roman Urdu on paper slips, sometimes printed.',
  'Numbers are in PKR.',
  'Return strict JSON only matching this schema (no commentary):',
  '{',
  '  "workshopName": string | null,',
  '  "workshopContact": string | null,    // phone or contact name',
  '  "partsList": Array<{ "name": string, "qty": number, "unitPricePkr": number }> | null,',
  '  "laborTotalPkr": number | null,',
  '  "totalQuotePkr": number | null,',
  '  "etaDays": number | null,',
  '  "warrantyDays": number | null,',
  '  "confidence": number,                 // self-assessed 0..1',
  '  "rawText": string                     // verbatim text you read',
  '}',
  'Use null for any field you cannot read with reasonable certainty.',
  'Set confidence honestly: <0.5 if writing is hard to read or many fields are guessed.',
].join('\n');

export async function extractDieselReceipt(imageUrl: string): Promise<DieselReceiptExtract> {
  const raw = await callOpenAi(
    DIESEL_SYSTEM,
    'Extract the diesel pump receipt fields from this photo. Output JSON only.',
    imageUrl,
  );
  const parsed = safeJsonParse(raw);
  if (!parsed) return emptyDieselExtract();
  const result = dieselReceiptExtractSchema.safeParse(parsed);
  if (!result.success) {
    const rawText = typeof (parsed as { rawText?: unknown }).rawText === 'string' ? ((parsed as { rawText: string }).rawText) : '';
    return emptyDieselExtract(rawText);
  }
  return result.data;
}

export async function extractRepairQuote(imageUrl: string): Promise<RepairQuoteExtract> {
  const raw = await callOpenAi(
    REPAIR_SYSTEM,
    'Extract the workshop repair quote fields from this photo. Output JSON only.',
    imageUrl,
  );
  const parsed = safeJsonParse(raw);
  if (!parsed) return emptyRepairExtract();
  const result = repairQuoteExtractSchema.safeParse(parsed);
  if (!result.success) {
    const rawText = typeof (parsed as { rawText?: unknown }).rawText === 'string' ? ((parsed as { rawText: string }).rawText) : '';
    return emptyRepairExtract(rawText);
  }
  return result.data;
}

const RAW_TEXT_SYSTEM = [
  'You transcribe text from images. The text may be in Urdu, Roman Urdu, or English.',
  'Return strict JSON: { "text": string, "confidence": number }.',
  'confidence is self-assessed 0..1.',
].join('\n');

export async function extractRawText(
  imageUrl: string,
  hint?: string,
): Promise<{ text: string; confidence: number }> {
  const raw = await callOpenAi(
    RAW_TEXT_SYSTEM,
    hint ? `Transcribe. Context: ${hint}` : 'Transcribe the text visible in this image.',
    imageUrl,
  );
  const parsed = safeJsonParse<{ text?: unknown; confidence?: unknown }>(raw);
  if (!parsed) return { text: '', confidence: 0 };
  const text = typeof parsed.text === 'string' ? parsed.text : '';
  const conf = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
  return { text, confidence: conf };
}
