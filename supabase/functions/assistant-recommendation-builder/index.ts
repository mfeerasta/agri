// assistant-recommendation-builder
// Schedule: pg_cron at 06:00 + 16:00 PKT (01:00 + 11:00 UTC).
// For every active entity, gathers cross-module signals (weather, soil
// moisture, irrigation gap, low inventory, overdue approvals, ripe fields,
// upcoming compliance) and asks Claude to phrase the top 10 recommendations.

import { getServiceClient, jsonResponse, pktTodayIso, pktAddDays } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = Deno.env.get('ZAMEEN_CLAUDE_MODEL') ?? 'claude-3-5-sonnet-20241022';

interface RecommendationDraft {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  fieldId?: string;
  title: string;
  titleUr?: string;
  rationale: string;
  recommendedAction: string;
  relatedData?: Record<string, unknown>;
}

async function gatherSignals(entityId: string, supabase: ReturnType<typeof getServiceClient>) {
  const today = pktTodayIso();
  const horizon = pktAddDays(today, 7);

  const [weather, soil, irrigation, lowInv, overdueApp, harvests, compliance] = await Promise.all([
    supabase.from('weather_alerts').select('field_id,kind,severity,starts_at').eq('entity_id', entityId).gte('starts_at', today).limit(20),
    supabase.from('smap_observations').select('field_id,soil_moisture_pct,observed_at').eq('entity_id', entityId).order('observed_at', { ascending: false }).limit(40),
    supabase.from('irrigation_events').select('field_id,executed_at').eq('entity_id', entityId).order('executed_at', { ascending: false }).limit(40),
    supabase.from('inventory_forecasts').select('input_id,days_until_stockout,recommended_reorder_by_date').lte('days_until_stockout', 14).limit(30),
    supabase.from('approval_requests').select('id,kind,created_at,state').eq('entity_id', entityId).eq('state', 'pending').lte('created_at', pktAddDays(today, -2)).limit(20),
    supabase.from('harvest_logs').select('field_id,crop_code,readiness_pct').eq('entity_id', entityId).gte('readiness_pct', 80).limit(20),
    supabase.from('compliance_documents').select('id,title,expires_at').eq('entity_id', entityId).lte('expires_at', horizon).limit(20),
  ]);

  return {
    entityId,
    weather: (weather.data ?? []).map((w) => ({ fieldId: w.field_id, forecast: w.kind, risk: w.severity })),
    soilMoisture: (soil.data ?? []).map((s) => ({ fieldId: s.field_id, valuePct: s.soil_moisture_pct, threshold: 25 })),
    irrigationGaps: (irrigation.data ?? []).map((i) => ({ fieldId: i.field_id, daysSinceLast: 0, warabandiNextAt: null })),
    lowInventory: (lowInv.data ?? []).map((l) => ({ inputName: l.input_id, daysUntilStockout: l.days_until_stockout })),
    overdueApprovals: (overdueApp.data ?? []).map((a) => ({ id: a.id, type: a.kind, ageHours: 48 })),
    ripeForHarvest: (harvests.data ?? []).map((h) => ({ fieldId: h.field_id, cropCode: h.crop_code, readinessPct: h.readiness_pct })),
    upcomingCompliance: (compliance.data ?? []).map((c) => ({ docId: c.id, title: c.title, dueAt: c.expires_at })),
  };
}

async function rankWithClaude(signals: unknown): Promise<RecommendationDraft[]> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return [];
  const system =
    'You are the Zameen recommendation engine. Given signals across modules, output up to 10 ranked recommendations as a JSON array. No markdown. Never use em-dashes.';
  const user =
    'Signals: ' + JSON.stringify(signals) +
    '\nReturn an array of {category,priority,fieldId,title,titleUr,rationale,recommendedAction,relatedData}.';

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.2,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
  try {
    const parsed = JSON.parse(text) as RecommendationDraft[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

Deno.serve(instrument('assistant-recommendation-builder', async () => {
  const supabase = getServiceClient();

  const { data: entities, error } = await supabase
    .from('entities')
    .select('id')
    .eq('active', true);
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);

  let inserted = 0;
  for (const ent of entities ?? []) {
    const signals = await gatherSignals(ent.id, supabase);
    const drafts = await rankWithClaude(signals);
    if (drafts.length === 0) continue;

    const rows = drafts.map((d) => ({
      entity_id: ent.id,
      category: d.category,
      priority: d.priority,
      field_id: d.fieldId ?? null,
      title: d.title,
      title_ur: d.titleUr ?? null,
      rationale: d.rationale,
      recommended_action: d.recommendedAction,
      related_data: d.relatedData ?? null,
    }));
    const { error: insErr } = await supabase.from('assistant_recommendations').insert(rows);
    if (!insErr) inserted += rows.length;
  }

  return jsonResponse({ ok: true, inserted });
}));
