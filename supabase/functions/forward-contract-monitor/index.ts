// forward-contract-monitor
// Schedule: pg_cron daily at 06:30 PKT.
// Flags any open/partially_delivered forward contract whose delivery_window_end
// is within the next 14 days and where delivered_kg / committed_kg < 50%.
// Notifies directors per entity.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface ContractRow {
  id: string;
  entity_id: string;
  contract_number: string;
  crop_code: string;
  committed_kg: string;
  delivered_kg: string;
  delivery_window_end: string;
  status: string;
}

Deno.serve(instrument('forward-contract-monitor', async () => {
  const supabase = getServiceClient();
  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .schema('zameen')
    .from('forward_contracts')
    .select('id, entity_id, contract_number, crop_code, committed_kg, delivered_kg, delivery_window_end, status')
    .in('status', ['open', 'partially_delivered'])
    .lte('delivery_window_end', horizonIso);
  if (error) return jsonResponse({ error: error.message }, 500);

  let notified = 0;
  for (const c of (rows ?? []) as ContractRow[]) {
    const committed = Number(c.committed_kg);
    const delivered = Number(c.delivered_kg);
    const ratio = committed > 0 ? delivered / committed : 0;
    if (ratio >= 0.5) continue;

    const { data: directors } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', c.entity_id)
      .eq('role', 'director')
      .eq('is_active', true);

    const remainingKg = Math.max(0, committed - delivered);
    const title = `Forward contract ${c.contract_number} breach risk`;
    const body = `${c.crop_code}: ${delivered.toLocaleString()} of ${committed.toLocaleString()} kg delivered (${(ratio * 100).toFixed(0)}%). Window ends ${c.delivery_window_end}. ${remainingKg.toLocaleString()} kg outstanding.`;

    for (const r of directors ?? []) {
      await supabase.schema('zameen').from('notifications').insert({
        recipient_id: r.user_id,
        entity_id: c.entity_id,
        channel: 'in_app',
        category: 'forward_contract_breach_risk',
        title,
        body,
        deep_link: `/app/sales/forward-contracts/${c.id}`,
        payload: { contractId: c.id, ratio, remainingKg, windowEnd: c.delivery_window_end },
      });
      notified += 1;
    }
  }

  return jsonResponse({ scanned: (rows ?? []).length, notified });
}));
