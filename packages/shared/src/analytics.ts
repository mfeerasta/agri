/**
 * Fire-and-forget analytics helper. Never throws, never blocks UX.
 * Writes to zameen.platform_events via the Supabase REST endpoint with the
 * anon key. RLS allows inserts from any authenticated session.
 *
 * Never pass PII beyond user_id. Props should be small primitives only.
 */

export interface TrackEventInput {
  name: string;
  props?: Record<string, unknown>;
  userId?: string;
  entityId?: string;
  userAgent?: string;
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return;

  const body = {
    event_name: input.name,
    event_props: input.props ?? {},
    user_id: input.userId ?? null,
    entity_id: input.entityId ?? null,
    user_agent: input.userAgent ?? null,
  };

  try {
    await fetch(`${url}/rest/v1/platform_events`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
        'Content-Profile': 'zameen',
      },
      body: JSON.stringify(body),
      // Don't await downstream of caller; cap latency.
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Swallow. Analytics must never block.
  }
}

export const PLATFORM_EVENTS = {
  pageView: 'page_view',
  approvalSubmitted: 'approval_submitted',
  approvalDecided: 'approval_decided',
  dieselLogged: 'diesel_logged',
  aiAssistantInvoked: 'ai_assistant_invoked',
  exportDownloaded: 'export_downloaded',
  trainingModeToggled: 'training_mode_toggled',
  tourCompleted: 'tour_completed',
  tourSkipped: 'tour_skipped',
} as const;
