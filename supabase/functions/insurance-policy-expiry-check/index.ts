// insurance-policy-expiry-check
// Schedule: pg_cron daily at 02:00 PKT.
// Marks insurance_policies past effective_to as expired and notifies primary user
// 30 days before any active policy lapses.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface PolicyRow {
  id: string;
  entity_id: string;
  policy_number: string;
  insurer_name: string;
  effective_to: string;
  status: string;
}

Deno.serve(instrument('insurance-policy-expiry-check', async () => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyOut = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const { data: lapsed, error: lapsedErr } = await supabase
    .schema('zameen')
    .from('insurance_policies')
    .select('id, entity_id, policy_number, insurer_name, effective_to, status')
    .eq('status', 'active')
    .lt('effective_to', today);
  if (lapsedErr) return jsonResponse({ error: lapsedErr.message }, 500);

  let expired = 0;
  for (const p of (lapsed ?? []) as PolicyRow[]) {
    const { error: upErr } = await supabase
      .schema('zameen')
      .from('insurance_policies')
      .update({ status: 'expired' })
      .eq('id', p.id);
    if (!upErr) expired += 1;
  }

  const { data: expiring, error: expErr } = await supabase
    .schema('zameen')
    .from('insurance_policies')
    .select('id, entity_id, policy_number, insurer_name, effective_to, status')
    .eq('status', 'active')
    .gte('effective_to', today)
    .lte('effective_to', thirtyOut);
  if (expErr) return jsonResponse({ error: expErr.message }, 500);

  let notified = 0;
  for (const p of (expiring ?? []) as PolicyRow[]) {
    const { data: directors } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', p.entity_id)
      .eq('role', 'director')
      .eq('is_active', true);
    for (const d of directors ?? []) {
      const daysLeft = Math.max(
        0,
        Math.round((new Date(p.effective_to).getTime() - Date.now()) / 86_400_000),
      );
      await supabase.schema('zameen').from('notifications').insert({
        recipient_id: d.user_id,
        entity_id: p.entity_id,
        channel: 'in_app',
        category: 'insurance_expiry',
        title: `Policy ${p.policy_number} lapses in ${daysLeft}d`,
        body: `${p.insurer_name} policy expires on ${p.effective_to}. Renew before lapse.`,
        deep_link: `/compliance/insurance/policies/${p.id}`,
        payload: { policyId: p.id, daysLeft },
      });
      notified += 1;
    }
  }

  return jsonResponse({ expired, notified });
}));
