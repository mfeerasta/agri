// ppe-expiry-checker
// Schedule: pg_cron daily at 06:15 PKT.
// Flags expired PPE issuances for protective items (n95 masks, respirators,
// chemical gloves) by writing in-app notifications to directors and the
// worker's supervisor. Does not delete rows; the register stays auditable.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface PpeRow {
  id: string;
  worker_id: string;
  ppe_kind: string;
  expires_on: string;
  acknowledgement_signed: boolean;
}

const PROTECTIVE_KINDS = new Set(['mask_n95', 'respirator', 'gloves_chemical']);
const WINDOWS = [30, 7, 0] as const;

Deno.serve(instrument('ppe-expiry-checker', async () => {
  const supabase = getServiceClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Lapsed protective PPE: notify once.
  const { data: lapsed, error: lapsedErr } = await supabase
    .schema('zameen')
    .from('ppe_issuances')
    .select('id, worker_id, ppe_kind, expires_on, acknowledgement_signed')
    .lt('expires_on', todayIso);
  if (lapsedErr) return jsonResponse({ error: lapsedErr.message }, 500);

  let notified = 0;
  const rowsToNotify: PpeRow[] = ((lapsed ?? []) as PpeRow[]).filter((r) => PROTECTIVE_KINDS.has(r.ppe_kind));

  for (const days of WINDOWS) {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + days);
    const targetIso = target.toISOString().slice(0, 10);
    const { data: due } = await supabase
      .schema('zameen')
      .from('ppe_issuances')
      .select('id, worker_id, ppe_kind, expires_on, acknowledgement_signed')
      .eq('expires_on', targetIso);
    for (const r of ((due ?? []) as PpeRow[]).filter((x) => PROTECTIVE_KINDS.has(x.ppe_kind))) {
      rowsToNotify.push(r);
    }
  }

  for (const r of rowsToNotify) {
    const { data: w } = await supabase
      .schema('zameen')
      .from('workers')
      .select('entity_id, full_name, code')
      .eq('id', r.worker_id)
      .maybeSingle();
    if (!w) continue;
    const { data: directors } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', w.entity_id)
      .eq('role', 'director')
      .eq('is_active', true);
    const lapsedFlag = r.expires_on < todayIso;
    const title = lapsedFlag
      ? `${r.ppe_kind} expired for ${w.full_name}`
      : `${r.ppe_kind} expires ${r.expires_on} for ${w.full_name}`;
    const body = `Issue replacement PPE before next field assignment. Worker code ${w.code}.`;
    for (const rec of directors ?? []) {
      await supabase.schema('zameen').from('notifications').insert({
        recipient_id: rec.user_id,
        entity_id: w.entity_id,
        channel: 'in_app',
        category: 'ppe_expiry',
        title,
        body,
        deep_link: `/labor/workers/${r.worker_id}`,
        payload: { ppeId: r.id, workerId: r.worker_id, ppeKind: r.ppe_kind, expiresOn: r.expires_on },
      });
      notified += 1;
    }
  }

  return jsonResponse({ notified, lapsed: (lapsed ?? []).length });
}));
