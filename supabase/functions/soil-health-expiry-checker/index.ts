// soil-health-expiry-checker
// Schedule: pg_cron weekly on Monday at 06:00 PKT.
// Flags fields whose latest soil_health_cards.valid_until is within 6 months
// so the field team plans a re-sampling event.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface CardRow {
  id: string;
  field_id: string;
  card_number: string;
  valid_until: string;
}

Deno.serve(
  instrument('soil-health-expiry-checker', async () => {
    const supabase = getServiceClient();
    const now = new Date();
    const horizon = new Date(now.getTime() + 6 * 30 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .schema('zameen')
      .from('soil_health_cards')
      .select('id, field_id, card_number, valid_until')
      .lte('valid_until', horizon)
      .gte('valid_until', today);
    if (error) return jsonResponse({ error: error.message }, 500);

    const rows = (data ?? []) as CardRow[];
    // De-dupe to the latest card per field by valid_until.
    const latestByField = new Map<string, CardRow>();
    for (const r of rows) {
      const existing = latestByField.get(r.field_id);
      if (!existing || existing.valid_until < r.valid_until) {
        latestByField.set(r.field_id, r);
      }
    }

    let flagged = 0;
    for (const row of latestByField.values()) {
      const daysLeft = Math.ceil(
        (new Date(row.valid_until).getTime() - now.getTime()) / (24 * 3600 * 1000),
      );
      const { error: notifErr } = await supabase
        .schema('zameen')
        .from('platform_events')
        .insert({
          event_kind: 'soil_health_expiry_warning',
          payload: {
            fieldId: row.field_id,
            cardId: row.id,
            cardNumber: row.card_number,
            validUntil: row.valid_until,
            daysLeft,
          },
        });
      if (!notifErr) flagged += 1;
    }

    return jsonResponse({ checked: rows.length, flagged });
  }),
);
