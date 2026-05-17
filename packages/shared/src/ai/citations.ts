/**
 * AI call logging helper. Writes one row per Claude invocation to
 * zameen.ai_call_log for cost tracking and abuse detection. Failures here
 * never propagate; logging is best-effort.
 *
 * Schema lives in supabase/migrations/0019_ai_call_log.sql.
 */

export type AiCallKind =
  | 'chat'
  | 'search'
  | 'crop_advisor'
  | 'approval_explainer'
  | 'field_summary';

export interface AiCallLogInput {
  kind: AiCallKind;
  userId: string | null;
  entityId: string | null;
  promptSummary: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
  cached?: boolean;
  errorMessage?: string | null;
}

// Loose db handle to avoid a circular dependency between @zameen/shared
// and @zameen/db. Callers pass their own drizzle instance.
interface MinimalDb {
  execute(query: unknown): Promise<unknown>;
}

import { sql } from 'drizzle-orm';

export async function logAiCall(db: MinimalDb, row: AiCallLogInput): Promise<void> {
  try {
    await db.execute(sql`
      insert into zameen.ai_call_log (
        kind, user_id, entity_id, prompt_summary,
        input_tokens, output_tokens, latency_ms, model, cached, error_message
      ) values (
        ${row.kind}, ${row.userId}, ${row.entityId}, ${row.promptSummary},
        ${row.inputTokens}, ${row.outputTokens}, ${row.latencyMs}, ${row.model},
        ${row.cached ?? false}, ${row.errorMessage ?? null}
      )
    `);
  } catch {
    // best-effort: never break the user request because logging failed
  }
}

/**
 * Build a short prompt summary suitable for the audit log. Strips PII and
 * truncates to 200 chars.
 */
export function summarizePrompt(text: string): string {
  const cleaned = text
    .replace(/\b\d{13}\b/g, '[cnic]')
    .replace(/\b03\d{9}\b/g, '[phone]')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned;
}
