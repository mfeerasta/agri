/**
 * Claude vision-backed crop disease diagnoser.
 *
 * Sends a field photo plus crop context to Claude 3.5 Sonnet's vision API
 * and requests a JSON-only response shaped to DiagnosticResult. Responses
 * are validated through Zod before returning. On any failure (no key,
 * timeout, parse error, validation failure) we return a zero-confidence
 * result so callers can still persist the row and let supervisors review.
 *
 * Grounding: a static reference list of Punjab common pests, diseases, and
 * nutrient disorders is appended to the system prompt to reduce label drift.
 * Treatment suggestions are bilingual (en + ur) so field workers reading
 * Urdu and MF/supervisor reading English share the same record.
 *
 * No em-dashes in any text we render. The prompt enforces this.
 */

import {
  diagnosticResultSchema,
  type DiagnosticResultShape,
} from './validators/crop-diagnostics.js';
import diseaseLibrary from './lib/punjab-crop-diseases.json' with { type: 'json' };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 1500;

export interface DiagnosticResult {
  diagnosisLabel: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  treatmentSuggestion: string;
  treatmentSuggestionUr: string;
  alternativeDiagnoses: Array<{ label: string; confidence: number; reason: string }>;
  preventiveAdvice: string;
  rawText: string;
}

export interface DiagnoseArgs {
  imageUrl: string;
  cropName?: string;
  stage?: string;
  fieldHistoryHints?: string;
  model?: string;
}

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

interface DiseaseEntry {
  label: string;
  labelUr: string;
  crops: string[];
  symptoms: string;
  ipm: string;
  chemical: string;
}

interface DiseaseLibrary {
  version: string;
  context: string;
  entries: DiseaseEntry[];
}

const LIBRARY = diseaseLibrary as DiseaseLibrary;

function buildReferenceList(cropName?: string): string {
  const relevant = cropName
    ? LIBRARY.entries.filter((e) => e.crops.some((c) => c.toLowerCase() === cropName.toLowerCase()))
    : LIBRARY.entries;
  const list = relevant.length > 0 ? relevant : LIBRARY.entries;
  return list
    .map(
      (e) =>
        `- ${e.label} (ur: ${e.labelUr}). Symptoms: ${e.symptoms} IPM: ${e.ipm} Chemical: ${e.chemical}`,
    )
    .join('\n');
}

function buildSystemPrompt(cropName?: string): string {
  return [
    'You are an experienced agronomist diagnosing crop problems from field photos in Punjab, Pakistan.',
    'Look at the photo and identify the most likely problem: pest, fungal/bacterial/viral disease, nutrient deficiency, or abiotic stress.',
    'Respond ONLY with JSON. No prose, no markdown code fences, no preamble.',
    '',
    'Required JSON shape:',
    '{',
    '  "diagnosisLabel": string,            // e.g. "Wheat yellow rust (Puccinia striiformis)"',
    '  "confidence": number,                // 0..1 self-assessed',
    '  "severity": "mild" | "moderate" | "severe" | "unknown",',
    '  "treatmentSuggestion": string,        // English, IPM-leaning, practical for Punjab smallholder',
    '  "treatmentSuggestionUr": string,      // Urdu translation of treatmentSuggestion',
    '  "alternativeDiagnoses": [             // top 0-3 alternatives',
    '    { "label": string, "confidence": number, "reason": string }',
    '  ],',
    '  "preventiveAdvice": string,           // English, cultural + IPM, 1-2 sentences',
    '  "rawText": string                     // your own one-sentence visual observation',
    '}',
    '',
    'Style rules (mandatory):',
    '- Never use em-dashes. Use a comma or period instead.',
    '- Use simple direct language a supervisor can act on.',
    '- Suggest IPM (cultural + biological) first, then a specific named chemical with rate per acre.',
    '- If confidence < 0.5, label as "Unclear" and explain in rawText.',
    '- If the photo is not of a crop or is too blurry, set confidence to 0, label to "Unrecognized", and rawText to the reason.',
    '- Urdu translation should be plain, readable, no Roman Urdu mixed in.',
    '',
    'Reference list of common Punjab problems (use these labels when applicable):',
    buildReferenceList(cropName),
  ].join('\n');
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

function safeJsonParse(raw: string | null): unknown {
  if (!raw) return null;
  // Some models occasionally wrap JSON in ```json fences despite instructions. Strip them.
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

function toResult(parsed: DiagnosticResultShape): DiagnosticResult {
  return {
    diagnosisLabel: parsed.diagnosisLabel,
    confidence: parsed.confidence,
    severity: parsed.severity,
    treatmentSuggestion: parsed.treatmentSuggestion,
    treatmentSuggestionUr: parsed.treatmentSuggestionUr,
    alternativeDiagnoses: parsed.alternativeDiagnoses,
    preventiveAdvice: parsed.preventiveAdvice,
    rawText: parsed.rawText,
  };
}

export async function diagnoseCropPhoto(args: DiagnoseArgs): Promise<DiagnosticResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return emptyResult('');

  const model = args.model ?? process.env.ZAMEEN_CLAUDE_MODEL ?? DEFAULT_MODEL;
  const userParts = [
    `Crop (if known): ${args.cropName ?? 'unknown'}.`,
    `Growth stage (if known): ${args.stage ?? 'unknown'}.`,
    args.fieldHistoryHints ? `Recent field notes: ${args.fieldHistoryHints}` : '',
    'Diagnose the issue visible in this photo. Output JSON only.',
  ]
    .filter(Boolean)
    .join(' ');

  const body = {
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0.2,
    system: buildSystemPrompt(args.cropName),
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'url' as const, url: args.imageUrl } },
          { type: 'text' as const, text: userParts },
        ],
      },
    ],
  };

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
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return emptyResult('');
    const json = (await res.json()) as AnthropicResponse;
    const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
    const parsed = safeJsonParse(text);
    if (!parsed) return emptyResult(text);
    const validation = diagnosticResultSchema.safeParse(parsed);
    if (!validation.success) {
      const raw = typeof (parsed as { rawText?: unknown }).rawText === 'string'
        ? (parsed as { rawText: string }).rawText
        : text;
      return emptyResult(raw);
    }
    return toResult(validation.data);
  } catch {
    return emptyResult('');
  } finally {
    clearTimeout(timer);
  }
}
