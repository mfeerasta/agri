/**
 * Background recommendation builder.
 *
 * Runs from supabase/functions/assistant-recommendation-builder on cron
 * 06:00 + 16:00 Asia/Karachi. Pulls cross-module signals per entity,
 * asks Claude to rank and phrase the top-10, and stores the result for the
 * inbox UI.
 *
 * The signal-gathering layer is provided by callers because it needs db
 * access. This module only handles ranking + persistence shape.
 */

import { complete, HOUSE_STYLE } from '../anthropic.js';

export interface RecommendationSignals {
  entityId: string;
  weather: Array<{ fieldId: string; forecast: string; risk: string }>;
  soilMoisture: Array<{ fieldId: string; valuePct: number; threshold: number }>;
  irrigationGaps: Array<{ fieldId: string; daysSinceLast: number; warabandiNextAt: string | null }>;
  lowInventory: Array<{ inputName: string; daysUntilStockout: number }>;
  overdueApprovals: Array<{ id: string; type: string; ageHours: number }>;
  ripeForHarvest: Array<{ fieldId: string; cropCode: string; readinessPct: number }>;
  upcomingCompliance: Array<{ docId: string; title: string; dueAt: string }>;
}

export interface RecommendationDraft {
  category:
    | 'irrigation'
    | 'spray'
    | 'fertilizer'
    | 'harvest'
    | 'maintenance'
    | 'inventory'
    | 'financial'
    | 'staffing'
    | 'weather'
    | 'compliance';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  fieldId?: string;
  title: string;
  titleUr?: string;
  rationale: string;
  recommendedAction: string;
  relatedData?: Record<string, unknown>;
}

function buildSystem(): string {
  return [
    'You are the Zameen recommendation engine.',
    'Given live signals across modules, output up to 10 actionable recommendations.',
    'Rank by impact and time-sensitivity. Use these priorities:',
    '  urgent: blocks operations today (frost, pest outbreak, stockout).',
    '  high:   action needed within 48 hours.',
    '  medium: action this week.',
    '  low:    advisory.',
    'Be concrete. Each title is one short clause. Rationale references the input signal.',
    'recommendedAction states exactly what to do, naming the field id where applicable.',
    'titleUr is the title in Urdu script. Skip it for purely financial items.',
    'Return a JSON array. No prose, no markdown fences.',
    HOUSE_STYLE,
  ].join('\n');
}

function buildUserPrompt(signals: RecommendationSignals): string {
  return [
    'Signals for this entity:',
    JSON.stringify(signals, null, 2),
    '',
    'Produce up to 10 recommendation objects with the shape:',
    '{ "category": "...", "priority": "...", "fieldId": "...", "title": "...", "titleUr": "...", "rationale": "...", "recommendedAction": "...", "relatedData": {...} }',
  ].join('\n');
}

export async function buildRecommendationsForEntity(
  signals: RecommendationSignals,
): Promise<RecommendationDraft[]> {
  const res = await complete({
    system: buildSystem(),
    messages: [{ role: 'user', content: buildUserPrompt(signals) }],
    maxTokens: 2000,
    temperature: 0.2,
    cacheSystem: true,
  });
  if (!res.text) return [];
  try {
    const parsed = JSON.parse(res.text) as RecommendationDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10).filter((r) => r.title && r.rationale && r.recommendedAction);
  } catch {
    return [];
  }
}
