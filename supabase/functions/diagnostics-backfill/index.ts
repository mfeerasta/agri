// diagnostics-backfill
//
// POST { entityId?: string, limit?: number }. Walks zameen.crop_stage_logs.photo_urls
// looking for photos that don't yet have a zameen.crop_diagnostics row,
// calls the Anthropic vision API for each, and inserts diagnostic rows.
// Idempotent: photos already diagnosed are skipped.
//
// Required env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY
//   ZAMEEN_CLAUDE_MODEL (optional, defaults to claude-3-5-sonnet-20241022)

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const TIMEOUT_MS = 30_000;
const DEFAULT_LIMIT = 100;

interface DiagnosticResult {
  diagnosisLabel: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  treatmentSuggestion: string;
  treatmentSuggestionUr: string;
  alternativeDiagnoses: Array<{ label: string; confidence: number; reason: string }>;
  preventiveAdvice: string;
  rawText: string;
}

const SYSTEM_PROMPT = [
  'You are an experienced agronomist diagnosing crop problems from field photos in Punjab, Pakistan.',
  'Respond ONLY with JSON matching this shape:',
  '{',
  '  "diagnosisLabel": string,',
  '  "confidence": number,',
  '  "severity": "mild" | "moderate" | "severe" | "unknown",',
  '  "treatmentSuggestion": string,',
  '  "treatmentSuggestionUr": string,',
  '  "alternativeDiagnoses": [{"label": string, "confidence": number, "reason": string}],',
  '  "preventiveAdvice": string,',
  '  "rawText": string',
  '}',
  'Never use em-dashes. Use commas or periods.',
  'If photo is unrecognizable, use label "Unrecognized" with confidence 0.',
  'Suggest IPM (cultural + biological) first, then a named chemical with per-acre rate.',
  'Common targets: wheat rust, maize stem borer, fall armyworm, cotton bollworm, whitefly, CLCuV,',
  'rice blast, BPH, sugarcane top borer, citrus canker, citrus greening, N/P/K/Zn/B deficiencies.',
].join('\n');

function emptyResult(rawText = ''): DiagnosticResult {
  return {
    diagnosisLabel: 'Unrecognized',
    confidence: 0,
    severity: 'unknown',
    treatmentSuggestion: '',
    treatmentSuggestionUr: '',
    alternativeDiagnoses: [],
    preventiveAdvice: '',
    rawText,
  };
}

function safeJsonParse(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function diagnose(imageUrl: string): Promise<DiagnosticResult> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return emptyResult('');
  const model = Deno.env.get('ZAMEEN_CLAUDE_MODEL') ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: 'Diagnose this photo. Output JSON only.' },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return emptyResult('');
    const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
    const parsed = safeJsonParse(text);
    if (!parsed || typeof parsed !== 'object') return emptyResult(text);
    const p = parsed as Record<string, unknown>;
    return {
      diagnosisLabel: typeof p.diagnosisLabel === 'string' ? p.diagnosisLabel : 'Unrecognized',
      confidence: typeof p.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0,
      severity: (typeof p.severity === 'string' && ['mild', 'moderate', 'severe', 'unknown'].includes(p.severity))
        ? (p.severity as DiagnosticResult['severity'])
        : 'unknown',
      treatmentSuggestion: typeof p.treatmentSuggestion === 'string' ? p.treatmentSuggestion : '',
      treatmentSuggestionUr: typeof p.treatmentSuggestionUr === 'string' ? p.treatmentSuggestionUr : '',
      alternativeDiagnoses: Array.isArray(p.alternativeDiagnoses)
        ? p.alternativeDiagnoses.slice(0, 5).map((a) => {
            const ao = (a ?? {}) as Record<string, unknown>;
            return {
              label: typeof ao.label === 'string' ? ao.label : '',
              confidence: typeof ao.confidence === 'number' ? ao.confidence : 0,
              reason: typeof ao.reason === 'string' ? ao.reason : '',
            };
          }).filter((a) => a.label !== '')
        : [],
      preventiveAdvice: typeof p.preventiveAdvice === 'string' ? p.preventiveAdvice : '',
      rawText: typeof p.rawText === 'string' ? p.rawText : '',
    };
  } catch {
    return emptyResult('');
  } finally {
    clearTimeout(timer);
  }
}

interface StageRow {
  id: string;
  crop_plan_id: string;
  observed_on: string;
  photo_urls: string[];
  field_id: string | null;
  entity_id: string | null;
}

Deno.serve(instrument('diagnostics-backfill', async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const body = await req.json().catch(() => ({}));
  const limit = typeof body?.limit === 'number' ? Math.min(500, Math.max(1, body.limit)) : DEFAULT_LIMIT;
  const entityId = typeof body?.entityId === 'string' ? body.entityId : null;

  const sb = getServiceClient();

  // Pull candidate stage logs with photos. Join field -> block -> farm to filter by entity.
  const { data: rows, error } = await sb.rpc('zameen_diagnostics_backfill_candidates', {
    p_entity_id: entityId,
    p_limit: 500,
  }) as { data: StageRow[] | null; error: unknown };

  if (error) return jsonResponse({ error: String(error) }, 500);

  // Fall back to a direct query if RPC isn't present.
  let candidates: StageRow[] = rows ?? [];
  if (candidates.length === 0) {
    const { data: directRows } = await sb
      .from('crop_stage_logs')
      .select('id, crop_plan_id, observed_on, photo_urls, crop_plans(field_id, fields(blocks(farms(entity_id))))')
      .limit(500);
    candidates = (directRows ?? []).map((r: Record<string, unknown>) => {
      const plans = r.crop_plans as { field_id?: string; fields?: { blocks?: { farms?: { entity_id?: string } } } } | null;
      return {
        id: r.id as string,
        crop_plan_id: r.crop_plan_id as string,
        observed_on: r.observed_on as string,
        photo_urls: (r.photo_urls as string[]) ?? [],
        field_id: plans?.field_id ?? null,
        entity_id: plans?.fields?.blocks?.farms?.entity_id ?? null,
      };
    });
  }

  if (entityId) candidates = candidates.filter((c) => c.entity_id === entityId);

  // Pull already-diagnosed photo URLs to skip.
  const { data: existing } = await sb.from('crop_diagnostics').select('photo_url').limit(10000);
  const done = new Set((existing ?? []).map((e: { photo_url: string }) => e.photo_url));

  let processed = 0;
  for (const cand of candidates) {
    if (processed >= limit) break;
    if (!cand.field_id) continue;
    for (const url of cand.photo_urls ?? []) {
      if (processed >= limit) break;
      if (done.has(url)) continue;
      const diag = await diagnose(url);
      const observedDate = (cand.observed_on ?? new Date().toISOString()).slice(0, 10);
      const { error: insErr } = await sb.from('crop_diagnostics').insert({
        field_id: cand.field_id,
        crop_plan_id: cand.crop_plan_id,
        stage_log_id: cand.id,
        photo_url: url,
        observed_on: observedDate,
        diagnosis_label: diag.diagnosisLabel,
        confidence: diag.confidence,
        severity: diag.severity,
        treatment_suggestion: diag.treatmentSuggestion,
        treatment_suggestion_ur: diag.treatmentSuggestionUr,
        alternative_diagnoses: diag.alternativeDiagnoses,
        source: 'claude_vision',
        status: 'pending_review',
        raw_response: diag,
      });
      if (!insErr) processed += 1;
    }
  }

  return jsonResponse({ ok: true, processed });
}));
