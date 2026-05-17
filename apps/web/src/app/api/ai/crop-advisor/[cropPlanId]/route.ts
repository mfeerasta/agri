/**
 * GET /api/ai/crop-advisor/[cropPlanId]
 *
 * Claude-generated next-best-actions for a crop plan. Joins plan + profile +
 * field + recent weather + recent input issuances. Caches the response for
 * 24h in zameen.ai_advisor_cache.
 */

import { eq, and, desc, gte, sql } from 'drizzle-orm';
import {
  db,
  cropPlans,
  cropProfiles,
  fields,
  blocks,
  farms,
  soilTests,
  weatherRecords,
  inputIssuances,
} from '@zameen/db';
import { complete, HOUSE_STYLE, logAiCall, summarizePrompt } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AdvisorPayload {
  summary: string;
  nextActions: Array<{
    title: string;
    rationale: string;
    byDate: string | null;
    priority: 'low' | 'medium' | 'high';
  }>;
  risks: string[];
  confidence: number;
}

function emptyPayload(): AdvisorPayload {
  return { summary: 'AI advisor unavailable.', nextActions: [], risks: [], confidence: 0 };
}

const SYSTEM = [
  'You are an agronomist advising on a Pakistani farm crop plan. Output strict JSON only.',
  'Schema:',
  '{',
  '  "summary": string,',
  '  "nextActions": [{ "title": string, "rationale": string, "byDate": "YYYY-MM-DD" | null, "priority": "low" | "medium" | "high" }],',
  '  "risks": string[],',
  '  "confidence": number  // 0..1',
  '}',
  'Consider stage timeline, recent weather, soil pH, recent inputs.',
  'Limit nextActions to 5. Limit risks to 5. Do not invent records.',
  HOUSE_STYLE,
].join('\n\n');

async function readCache(cropPlanId: string): Promise<AdvisorPayload | null> {
  try {
    const rows = await db.execute(sql`
      select payload from zameen.ai_advisor_cache
      where kind = 'crop_advisor' and key = ${cropPlanId} and expires_at > now()
      limit 1
    `);
    const arr = rows as unknown as Array<{ payload: AdvisorPayload }>;
    return arr[0]?.payload ?? null;
  } catch {
    return null;
  }
}

async function writeCache(cropPlanId: string, payload: AdvisorPayload): Promise<void> {
  try {
    const json = JSON.stringify(payload);
    await db.execute(sql`
      insert into zameen.ai_advisor_cache (kind, key, payload, expires_at)
      values ('crop_advisor', ${cropPlanId}, ${json}::jsonb, now() + interval '24 hours')
      on conflict (kind, key) do update set payload = excluded.payload, expires_at = excluded.expires_at
    `);
  } catch {
    // best effort
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cropPlanId: string }> },
): Promise<Response> {
  const session = await getSessionContext();
  if (!session) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { cropPlanId } = await ctx.params;

  const cached = await readCache(cropPlanId);
  if (cached) {
    return Response.json({ ...cached, cached: true });
  }

  const limit = rateLimit(`ai-advisor:${session.userId}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const [plan] = await db
    .select({
      id: cropPlans.id,
      currentStage: cropPlans.currentStage,
      seasonLabel: cropPlans.seasonLabel,
      plannedAcres: cropPlans.plannedAcres,
      plannedSowingDate: cropPlans.plannedSowingDate,
      plannedHarvestDate: cropPlans.plannedHarvestDate,
      cropName: cropProfiles.name,
      stageTimeline: cropProfiles.stageTimeline,
      growthDurationDays: cropProfiles.growthDurationDays,
      recommendedInputs: cropProfiles.recommendedInputs,
      fieldId: cropPlans.fieldId,
      fieldName: fields.name,
      fieldCode: fields.code,
      farmId: blocks.farmId,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .leftJoin(blocks, eq(blocks.id, fields.blockId))
    .where(eq(cropPlans.id, cropPlanId))
    .limit(1);

  if (!plan) {
    return Response.json({ error: 'Crop plan not found' }, { status: 404 });
  }

  // Latest soil test
  const soil = await db
    .select()
    .from(soilTests)
    .where(eq(soilTests.fieldId, plan.fieldId))
    .orderBy(desc(soilTests.testedOn))
    .limit(1);

  // Last 7 days of weather for the entity
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
  const weather = await db
    .select()
    .from(weatherRecords)
    .where(and(eq(weatherRecords.entityId, session.entityId), gte(weatherRecords.recordedFor, sevenDaysAgo)))
    .orderBy(desc(weatherRecords.recordedFor))
    .limit(14);

  // Recent inputs
  const inputs = await db
    .select()
    .from(inputIssuances)
    .where(eq(inputIssuances.cropPlanId, cropPlanId))
    .orderBy(desc(inputIssuances.issuedOn))
    .limit(10);

  const userPrompt = [
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Crop: ${plan.cropName ?? 'unknown'} season ${plan.seasonLabel}`,
    `Field: ${plan.fieldCode} ${plan.fieldName ?? ''} (${plan.plannedAcres} acres)`,
    `Current stage: ${plan.currentStage}`,
    `Planned sowing: ${plan.plannedSowingDate ?? 'n/a'}`,
    `Planned harvest: ${plan.plannedHarvestDate ?? 'n/a'}`,
    `Growth duration: ${plan.growthDurationDays ?? 'unknown'} days`,
    `Stage timeline: ${JSON.stringify(plan.stageTimeline ?? null)}`,
    `Recommended inputs: ${JSON.stringify(plan.recommendedInputs ?? null)}`,
    `Latest soil test: ${soil[0] ? JSON.stringify({ ph: soil[0].ph, n: soil[0].nitrogenPpm, p: soil[0].phosphorusPpm, k: soil[0].potassiumPpm, om: soil[0].organicMatterPct }) : 'none'}`,
    `Last 7 days weather: ${JSON.stringify(weather.map((w) => ({ d: w.recordedFor, min: w.minTempC, max: w.maxTempC, rain: w.rainfallMm })))}`,
    `Recent inputs: ${JSON.stringify(inputs.map((i) => ({ on: i.issuedOn, qty: i.quantity })))}`,
    '',
    'Return JSON only.',
  ].join('\n');

  const startedAt = Date.now();
  const result = await complete({
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1024,
    temperature: 0.3,
  });

  let parsed: AdvisorPayload;
  try {
    parsed = JSON.parse(result.text) as AdvisorPayload;
    if (!parsed.summary || !Array.isArray(parsed.nextActions)) throw new Error('bad shape');
  } catch {
    parsed = emptyPayload();
  }

  void logAiCall(db, {
    kind: 'crop_advisor',
    userId: session.userId,
    entityId: session.entityId,
    promptSummary: summarizePrompt(`crop ${plan.cropName} ${plan.currentStage}`),
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    latencyMs: Date.now() - startedAt,
    model: process.env.ZAMEEN_CLAUDE_MODEL ?? 'claude-3-5-sonnet-20241022',
  });

  if (parsed.confidence > 0) {
    await writeCache(cropPlanId, parsed);
  }

  return Response.json(parsed);
}
