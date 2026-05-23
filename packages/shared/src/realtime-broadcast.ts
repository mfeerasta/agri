/**
 * Helper to broadcast custom realtime events through Supabase channels.
 * Use for events that do not have a row in zameen.live_activity (e.g. weather alerts
 * computed in edge functions, push notifications, system pings).
 *
 * Subscribers join the same channel name and listen via channel.on('broadcast', ...).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type BroadcastSeverity = 'info' | 'warn' | 'alert' | 'critical';

export interface BroadcastEvent {
  kind: string;
  entityId: string;
  fieldId?: string | null;
  summary: string;
  summaryUr?: string;
  severity?: BroadcastSeverity;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

export function liveActivityChannelName(entityId: string): string {
  return `live-activity:${entityId}`;
}

export async function broadcastLiveEvent(
  supabase: SupabaseClient,
  event: BroadcastEvent,
): Promise<void> {
  const channel = supabase.channel(liveActivityChannelName(event.entityId));
  await channel.send({
    type: 'broadcast',
    event: event.kind,
    payload: {
      ...event,
      severity: event.severity ?? 'info',
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    },
  });
  await supabase.removeChannel(channel);
}
