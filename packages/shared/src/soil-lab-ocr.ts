/**
 * Vision-backed OCR for Pakistani soil laboratory test reports.
 * Extracts the ~30 parameters needed to populate `zameen.soil_health_cards`.
 * On any failure, returns an empty extract so the UI can fall back to manual.
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const VISION_MODEL = 'gpt-4o';
const TIMEOUT_MS = 45_000;

export interface SoilLabExtract {
  cardNumber: string | null;
  issuedOn: string | null;
  laboratory: string | null;
  compositeSampleCount: number | null;
  ph: number | null;
  electricalConductivityDsPerM: number | null;
  organicMatterPct: number | null;
  organicCarbonPct: number | null;
  cecCmolPerKg: number | null;
  nitrogenTotalPct: number | null;
  phosphorusAvailPpm: number | null;
  potassiumAvailPpm: number | null;
  sulphurPpm: number | null;
  zincPpm: number | null;
  ironPpm: number | null;
  manganesePpm: number | null;
  copperPpm: number | null;
  boronPpm: number | null;
  textureClass: string | null;
  clayPct: number | null;
  sandPct: number | null;
  siltPct: number | null;
  bulkDensityGPerCm3: number | null;
  infiltrationRateCmPerHr: number | null;
  carbonatePct: number | null;
  salinityClass: string | null;
  sodicityClass: string | null;
  confidence: number;
  rawText: string;
}

function empty(rawText = ''): SoilLabExtract {
  return {
    cardNumber: null,
    issuedOn: null,
    laboratory: null,
    compositeSampleCount: null,
    ph: null,
    electricalConductivityDsPerM: null,
    organicMatterPct: null,
    organicCarbonPct: null,
    cecCmolPerKg: null,
    nitrogenTotalPct: null,
    phosphorusAvailPpm: null,
    potassiumAvailPpm: null,
    sulphurPpm: null,
    zincPpm: null,
    ironPpm: null,
    manganesePpm: null,
    copperPpm: null,
    boronPpm: null,
    textureClass: null,
    clayPct: null,
    sandPct: null,
    siltPct: null,
    bulkDensityGPerCm3: null,
    infiltrationRateCmPerHr: null,
    carbonatePct: null,
    salinityClass: null,
    sodicityClass: null,
    confidence: 0,
    rawText,
  };
}

const SYSTEM = [
  'You extract structured fields from photos or scans of Pakistani soil laboratory test reports.',
  'Reports may be from government Soil Fertility labs (Punjab, Sindh) or private labs.',
  'Return strict JSON only matching exactly these keys. Use null when uncertain.',
  '{',
  '  "cardNumber": string | null,',
  '  "issuedOn": string | null,                 // ISO date',
  '  "laboratory": string | null,',
  '  "compositeSampleCount": number | null,',
  '  "ph": number | null,',
  '  "electricalConductivityDsPerM": number | null,',
  '  "organicMatterPct": number | null,',
  '  "organicCarbonPct": number | null,',
  '  "cecCmolPerKg": number | null,',
  '  "nitrogenTotalPct": number | null,',
  '  "phosphorusAvailPpm": number | null,',
  '  "potassiumAvailPpm": number | null,',
  '  "sulphurPpm": number | null,',
  '  "zincPpm": number | null,',
  '  "ironPpm": number | null,',
  '  "manganesePpm": number | null,',
  '  "copperPpm": number | null,',
  '  "boronPpm": number | null,',
  '  "textureClass": string | null,             // one of sand, loamy_sand, sandy_loam, loam, silt_loam, silt, sandy_clay_loam, clay_loam, silty_clay_loam, sandy_clay, silty_clay, clay',
  '  "clayPct": number | null,',
  '  "sandPct": number | null,',
  '  "siltPct": number | null,',
  '  "bulkDensityGPerCm3": number | null,',
  '  "infiltrationRateCmPerHr": number | null,',
  '  "carbonatePct": number | null,',
  '  "salinityClass": string | null,            // non_saline, slightly_saline, moderately_saline, strongly_saline, very_strongly_saline',
  '  "sodicityClass": string | null,            // non_sodic, slightly_sodic, moderately_sodic, strongly_sodic',
  '  "confidence": number,                       // 0..1',
  '  "rawText": string',
  '}',
].join('\n');

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export async function extractSoilLabReport(imageUrl: string): Promise<SoilLabExtract> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return empty();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: 'json_object' },
        max_tokens: 2500,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract soil lab report fields. JSON only.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return empty();
    const json = (await res.json()) as OpenAiChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) return empty();
    try {
      const parsed = JSON.parse(content) as Partial<SoilLabExtract>;
      return { ...empty(parsed.rawText ?? ''), ...parsed } as SoilLabExtract;
    } catch {
      return empty();
    }
  } catch {
    return empty();
  } finally {
    clearTimeout(timer);
  }
}
