'use server';

// advisory-actions
// Server actions for uploading and querying external crop advisories (PARC,
// FAO, others). Admin uploads a PDF URL; Claude vision extracts a structured
// summary and Urdu translation. Results stored in zameen.external_advisories
// and surfaced on crop-plan detail pages by commodity match.

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db, externalAdvisories } from '@zameen/db';
import { complete } from '@zameen/shared';

export interface UploadAdvisoryInput {
  pdfUrl: string;
  source: string;
  title: string;
  region?: string;
  entityId?: string;
  ingestedBy?: string;
  publishedOn?: string;
}

export interface AdvisoryExtraction {
  summary: string;
  summaryUr: string;
  commodities: string[];
  keyRecommendations: Array<{ recommendation: string; recommendationUr?: string }>;
}

const EXTRACTION_PROMPT = `You are an agronomy assistant ingesting a Pakistani crop advisory PDF.
Return strict JSON with keys: summary (2-4 sentences English), summaryUr (Urdu Nastaliq translation),
commodities (lowercase kebab-case list, e.g. ["wheat","rice-basmati"]), keyRecommendations
(array of {recommendation, recommendationUr}). No extra prose. No markdown fences.`;

async function extractWithClaude(pdfUrl: string, title: string): Promise<AdvisoryExtraction> {
  const fallback: AdvisoryExtraction = {
    summary: title,
    summaryUr: '',
    commodities: [],
    keyRecommendations: [],
  };
  try {
    const res = await complete({
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Title: ${title}\nPDF URL: ${pdfUrl}\nReturn JSON only.`,
        },
      ],
      maxTokens: 1500,
    });
    if (!res.text) return fallback;
    const json = res.text.trim().replace(/^```json\s*|\s*```$/g, '');
    const parsed = JSON.parse(json) as Partial<AdvisoryExtraction>;
    return {
      summary: parsed.summary ?? title,
      summaryUr: parsed.summaryUr ?? '',
      commodities: Array.isArray(parsed.commodities)
        ? parsed.commodities.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
        : [],
      keyRecommendations: Array.isArray(parsed.keyRecommendations)
        ? parsed.keyRecommendations
        : [],
    };
  } catch {
    return fallback;
  }
}

export async function uploadAdvisory(input: UploadAdvisoryInput): Promise<{ id: string }> {
  if (!input.pdfUrl || !input.title || !input.source) {
    throw new Error('pdfUrl, title, and source are required');
  }
  const extraction = await extractWithClaude(input.pdfUrl, input.title);
  const [row] = await db
    .insert(externalAdvisories)
    .values({
      source: input.source,
      title: input.title,
      pdfUrl: input.pdfUrl,
      region: input.region ?? null,
      entityId: input.entityId ?? null,
      ingestedBy: input.ingestedBy ?? null,
      publishedOn: input.publishedOn ?? new Date().toISOString().slice(0, 10),
      commodities: extraction.commodities,
      aiSummary: extraction.summary,
      aiSummaryUr: extraction.summaryUr,
      keyRecommendations: extraction.keyRecommendations,
    })
    .returning({ id: externalAdvisories.id });
  if (!row) throw new Error('Insert failed');
  return { id: row.id };
}

export interface SearchAdvisoriesInput {
  commodities?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export async function searchAdvisories(input: SearchAdvisoriesInput = {}) {
  const conditions = [] as Parameters<typeof and>[number][];
  if (input.dateFrom) conditions.push(gte(externalAdvisories.publishedOn, input.dateFrom));
  if (input.dateTo) conditions.push(lte(externalAdvisories.publishedOn, input.dateTo));
  if (input.commodities && input.commodities.length > 0) {
    conditions.push(sql`${externalAdvisories.commodities} && ${input.commodities}::text[]`);
  }
  const rows = await db
    .select()
    .from(externalAdvisories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(externalAdvisories.publishedOn))
    .limit(input.limit ?? 25);
  return rows;
}

export async function advisoriesForCommodity(commodity: string, limit = 5) {
  return searchAdvisories({ commodities: [commodity.toLowerCase().trim()], limit });
}

export async function getAdvisory(id: string) {
  const [row] = await db
    .select()
    .from(externalAdvisories)
    .where(eq(externalAdvisories.id, id))
    .limit(1);
  return row ?? null;
}
