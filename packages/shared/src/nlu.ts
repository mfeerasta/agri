/**
 * Natural-language understanding for inbound WhatsApp messages.
 *
 * Wraps the Anthropic Claude API to classify Urdu / Roman Urdu / mixed messages
 * from field workers and supervisors into structured Zameen intents
 * (task completion, diesel log, repair report, harvest, milk, attendance,
 * comment). Single-shot classification + extraction in one call.
 *
 * Claude is preferred over GPT-4 here because its tokenizer handles
 * non-Latin scripts (Urdu, Punjabi) more efficiently and it follows
 * JSON-output instructions reliably. See docs/decisions.md.
 *
 * The function runs in both Node (web app, server actions) and Deno
 * (supabase edge functions). It uses global fetch and reads the API key
 * from the host environment via a small adapter.
 */

export type IntentKind =
  | 'task_completion'
  | 'diesel_log'
  | 'diesel_purchase'
  | 'repair_report'
  | 'harvest_log'
  | 'milk_log'
  | 'attendance_check_in'
  | 'attendance_check_out'
  | 'comment'
  | 'unknown';

export type IntentLanguage = 'ur' | 'en' | 'roman_ur' | 'mixed';

export interface ParsedIntent {
  intent: IntentKind;
  confidence: number;
  fields: Record<string, string | number | boolean>;
  rawText: string;
  language: IntentLanguage;
  needsClarification?: { field: string; question: string }[];
}

export interface NluContextHints {
  activeFieldIds?: Array<{ id: string; code: string; nameUr?: string }>;
  activeAssetIds?: Array<{ id: string; code: string; category?: string }>;
  activeTaskCodes?: Array<{ id: string; code?: string; title: string }>;
  activeWorkerIds?: Array<{ id: string; fullName: string; phone?: string }>;
}

export interface ParseMessageInput {
  text: string;
  senderPhone: string;
  senderUserId?: string;
  contextHints?: NluContextHints;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const NLU_TIMEOUT_MS = 20_000;

function readEnv(key: string): string | undefined {
  // Node
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Deno
  const denoGlobal = (globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno;
  if (denoGlobal?.env) {
    return denoGlobal.env.get(key);
  }
  return undefined;
}

function buildSystemPrompt(): string {
  return `You parse WhatsApp messages from Pakistani agricultural workers and supervisors at Rupafab Agri into structured intents.

Workers write in Urdu, Roman Urdu, English, or any mix. Examples of vocabulary:
- paani / pani / آبپاشی = irrigation
- kaat / katai / کٹائی = harvest
- chhirkao / spray / سپرے = pesticide spray
- khaad / خاد = fertilizer
- diesel / ڈیزل + "litre" / "liter" / "L"
- ghante / گھنٹے = hours
- mann / من = local mass unit (~37.32 kg)
- T1, T2, H1 = asset codes (tractors, harvesters)
- F1, F2, F3 = field codes
- "haazri" / حاضری = attendance / check-in
- "chala gaya" / "ja raha" = check-out
- "kharab" / "tutt gaya" / خراب = broken (repair report)
- "doodh" / دودھ + "litre" = milk

Intents you must classify:
- task_completion: "F3 paani laga 6 ghante", "task T-23 done"
- diesel_log: "T1 mein 20 litre diesel daala F2 mein chala 4 ghante"
- diesel_purchase: "20 litre diesel kharida 18000 ka pump se" (no asset, has price + vendor)
- repair_report: "T1 ka pump kharab ho gaya", "harvester engine se awaz aa rahi hai"
- harvest_log: "F2 se 50 mann gandum cut hua"
- milk_log: "cow 12 se 8 litre doodh subah"
- attendance_check_in: "haazri lag gayi", "aa gaya"
- attendance_check_out: "ghar ja raha", "chhutti"
- comment: free text on a task code, e.g. "task T-23: pani thora hai"
- unknown: anything you cannot map confidently

Output rules:
1. Reply with ONLY a single valid JSON object, no prose, no markdown fences.
2. Schema:
{
  "intent": "<one of the above>",
  "confidence": <number 0..1>,
  "language": "ur" | "en" | "roman_ur" | "mixed",
  "fields": { ...intent-specific extracted fields... },
  "needsClarification": [ { "field": "<name>", "question": "<bilingual question>" } ]
}

3. Field extraction by intent:
- task_completion: { taskCode?, fieldCode?, fieldId?, hoursWorked?, notes? }
- diesel_log: { assetCode?, assetId?, fieldCode?, fieldId?, litres, hoursRun?, taskKind?, ratePerLitrePkr?, totalCostPkr? }
- diesel_purchase: { litres, totalPkr, ratePerLitrePkr?, vendorName?, paymentMethod? }
- repair_report: { assetCode?, assetId?, issue, severity? ("minor" | "major" | "critical") }
- harvest_log: { fieldCode?, fieldId?, cropPlanId?, grossYieldKg?, grossYieldMann?, acresHarvested? }
- milk_log: { animalEarTag?, animalId?, litres, session? ("am" | "pm" | "evening") }
- attendance_check_in / attendance_check_out: { workerName?, fieldCode? }
- comment: { taskCode?, body }

4. If sender provides an asset/field/task code that matches a code in the contextHints, also fill the matching <name>Id field with that UUID.

5. If a required field is missing or ambiguous, populate needsClarification with a SHORT bilingual question (Urdu + English). Use Urdu first. Example:
{ "field": "litres", "question": "کتنا لیٹر؟ How many litres?" }

6. confidence < 0.5 means the parse is unreliable. Use confidence < 0.5 only when you genuinely cannot decide.

7. Never invent IDs. Only fill *Id fields if the code clearly matches contextHints.

8. No em-dashes anywhere in output. Use plain hyphens or commas.`;
}

function buildUserPrompt(input: ParseMessageInput): string {
  const hints = input.contextHints ?? {};
  const fieldList = hints.activeFieldIds
    ? hints.activeFieldIds.map((f) => `${f.code}${f.nameUr ? ' (' + f.nameUr + ')' : ''} = ${f.id}`).join('\n')
    : '(none)';
  const assetList = hints.activeAssetIds
    ? hints.activeAssetIds.map((a) => `${a.code}${a.category ? ' (' + a.category + ')' : ''} = ${a.id}`).join('\n')
    : '(none)';
  const taskList = hints.activeTaskCodes
    ? hints.activeTaskCodes.map((t) => `${t.code ?? t.id.slice(0, 8)}: ${t.title} = ${t.id}`).join('\n')
    : '(none)';

  return `Sender phone: ${input.senderPhone}
Sender user ID: ${input.senderUserId ?? '(unknown)'}

Active fields (code = uuid):
${fieldList}

Active assets (code = uuid):
${assetList}

Open tasks (code = uuid):
${taskList}

Message:
"""
${input.text}
"""

Return the JSON object now.`;
}

function fallback(rawText: string): ParsedIntent {
  return {
    intent: 'unknown',
    confidence: 0,
    fields: {},
    rawText,
    language: 'mixed',
  };
}

function tryParseJson(content: string): unknown {
  const trimmed = content.trim();
  // Strip accidental code fences
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to locate the first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normaliseParsed(raw: unknown, rawText: string): ParsedIntent {
  if (!raw || typeof raw !== 'object') return fallback(rawText);
  const obj = raw as Record<string, unknown>;
  const intent = (obj.intent as IntentKind) ?? 'unknown';
  const validIntents: IntentKind[] = [
    'task_completion',
    'diesel_log',
    'diesel_purchase',
    'repair_report',
    'harvest_log',
    'milk_log',
    'attendance_check_in',
    'attendance_check_out',
    'comment',
    'unknown',
  ];
  const safeIntent = validIntents.includes(intent) ? intent : 'unknown';
  const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0;
  const language = (['ur', 'en', 'roman_ur', 'mixed'].includes(obj.language as string)
    ? obj.language
    : 'mixed') as IntentLanguage;
  const fields = (obj.fields && typeof obj.fields === 'object'
    ? (obj.fields as Record<string, string | number | boolean>)
    : {}) as Record<string, string | number | boolean>;
  const needsClarification = Array.isArray(obj.needsClarification)
    ? (obj.needsClarification as Array<{ field: string; question: string }>)
    : undefined;
  return {
    intent: safeIntent,
    confidence,
    language,
    fields,
    rawText,
    needsClarification: needsClarification && needsClarification.length > 0 ? needsClarification : undefined,
  };
}

export async function parseMessage(input: ParseMessageInput): Promise<ParsedIntent> {
  const apiKey = readEnv('ANTHROPIC_API_KEY');
  if (!apiKey) return fallback(input.text);

  const model = readEnv('ANTHROPIC_MODEL') ?? 'claude-3-5-sonnet-20241022';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NLU_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return fallback(input.text);
    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    if (!text) return fallback(input.text);
    const parsed = tryParseJson(text);
    if (!parsed) return fallback(input.text);
    return normaliseParsed(parsed, input.text);
  } catch {
    return fallback(input.text);
  } finally {
    clearTimeout(timer);
  }
}

export interface FeasibilityDraftInput {
  title: string;
  type: string;
  briefDescription: string;
  fieldContext?: string;
  capexEstimatePkr?: number;
  opexEstimatePkr?: number;
}

export interface FeasibilityDraft {
  background: string;
  scope: {
    objectives: string[];
    deliverables: string[];
    timelineMonths: number;
    boundaries: string;
  };
  costBreakdown: Array<{ category: string; subcategory?: string; amountPkr: number; notes?: string }>;
  capexEstimatePkr: number;
  opexEstimatePkr: number;
  revenueProjection: {
    yearOnePkr: number;
    yearTwoPkr: number;
    yearThreePkr: number;
    assumptions: string[];
  };
  yieldAssumptions: Record<string, string | number>;
  priceAssumptions: Record<string, string | number>;
  sensitivity: {
    yieldMinus20: { netPkr: number; note: string };
    priceMinus15: { netPkr: number; note: string };
    inputPlus10: { netPkr: number; note: string };
    baseline: { netPkr: number; note: string };
  };
  riskAssessment: {
    operational: Array<{ risk: string; likelihood: string; impact: string; mitigation: string }>;
    market: Array<{ risk: string; likelihood: string; impact: string; mitigation: string }>;
    financial: Array<{ risk: string; likelihood: string; impact: string; mitigation: string }>;
    regulatory: Array<{ risk: string; likelihood: string; impact: string; mitigation: string }>;
  };
  statusQuoComparison: {
    currentNetPkr: number;
    proposedNetPkr: number;
    deltaPkr: number;
    paybackMonths: number;
    note: string;
  };
}

function buildFeasibilitySystemPrompt(): string {
  return `You are an agribusiness analyst drafting feasibility studies for Rupafab Agri, a Pakistani family-owned farming operation. The Director (MF) signs off all studies.

Conventions:
- All money is in PKR. No FX.
- Pakistani agricultural context (Punjab, kharif/rabi seasons, mann/acre yields, mandi prices).
- No em-dashes. No "Confidential" markers. Plain hyphens and commas.
- Use realistic numbers grounded in local norms. State assumptions explicitly.
- Be concrete: cite acreage, varieties, expected per-acre numbers.

Output ONLY a single JSON object with this exact shape (no prose, no fences):
{
  "background": "<2-3 paragraph context for proposal>",
  "scope": {
    "objectives": ["..."],
    "deliverables": ["..."],
    "timelineMonths": <integer>,
    "boundaries": "<what is in and out of scope>"
  },
  "costBreakdown": [
    { "category": "capex" | "opex", "subcategory": "<short>", "amountPkr": <number>, "notes": "<optional>" }
  ],
  "capexEstimatePkr": <number>,
  "opexEstimatePkr": <number>,
  "revenueProjection": {
    "yearOnePkr": <number>, "yearTwoPkr": <number>, "yearThreePkr": <number>,
    "assumptions": ["..."]
  },
  "yieldAssumptions": { "<crop>": "<value>" },
  "priceAssumptions": { "<crop>": "<value>" },
  "sensitivity": {
    "yieldMinus20": { "netPkr": <number>, "note": "..." },
    "priceMinus15": { "netPkr": <number>, "note": "..." },
    "inputPlus10": { "netPkr": <number>, "note": "..." },
    "baseline": { "netPkr": <number>, "note": "..." }
  },
  "riskAssessment": {
    "operational": [ { "risk": "...", "likelihood": "low|medium|high", "impact": "low|medium|high", "mitigation": "..." } ],
    "market": [ { ... } ],
    "financial": [ { ... } ],
    "regulatory": [ { ... } ]
  },
  "statusQuoComparison": {
    "currentNetPkr": <number>, "proposedNetPkr": <number>, "deltaPkr": <number>,
    "paybackMonths": <number>, "note": "..."
  }
}`;
}

function buildFeasibilityUserPrompt(input: FeasibilityDraftInput): string {
  return `Title: ${input.title}
Type: ${input.type}
Brief: ${input.briefDescription}
Field context: ${input.fieldContext ?? '(none)'}
Capex hint (PKR): ${input.capexEstimatePkr ?? '(let the model estimate)'}
Opex hint (PKR): ${input.opexEstimatePkr ?? '(let the model estimate)'}

Generate the feasibility study JSON now.`;
}

export async function generateFeasibilityDraft(
  input: FeasibilityDraftInput,
): Promise<FeasibilityDraft | null> {
  const apiKey = readEnv('ANTHROPIC_API_KEY');
  if (!apiKey) return null;

  const model = readEnv('ANTHROPIC_MODEL') ?? 'claude-3-5-sonnet-20241022';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NLU_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: buildFeasibilitySystemPrompt(),
        messages: [{ role: 'user', content: buildFeasibilityUserPrompt(input) }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    if (!text) return null;
    const parsed = tryParseJson(text);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as FeasibilityDraft;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
