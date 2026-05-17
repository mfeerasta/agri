// approval-escalation
// Schedule: pg_cron hourly.
// Finds approval_requests stuck in submitted/in_review > 24h and re-fires notifications
// to the current approver or escalates to the next role above.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

interface ApprovalRow {
  id: string;
  entity_id: string;
  title: string;
  state: string;
  submitted_at: string | null;
  current_approver_id: string | null;
  amount_pkr: string | null;
}

Deno.serve(async () => {
  const supabase = getServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stuck, error } = await supabase
    .from('approval_requests')
    .select('id, entity_id, title, state, submitted_at, current_approver_id, amount_pkr')
    .in('state', ['submitted', 'in_review'])
    .lt('submitted_at', cutoff);
  if (error) return jsonResponse({ error: error.message }, 500);

  let nudged = 0;
  for (const r of (stuck ?? []) as ApprovalRow[]) {
    const recipients: string[] = [];
    if (r.current_approver_id) recipients.push(r.current_approver_id);

    const { data: directors } = await supabase
      .from('user_entity_roles')
      .select('user_id')
      .eq('entity_id', r.entity_id)
      .eq('role', 'director')
      .eq('is_active', true);
    for (const d of directors ?? []) {
      if (!recipients.includes(d.user_id)) recipients.push(d.user_id);
    }

    const ageHours = r.submitted_at
      ? Math.round((Date.now() - new Date(r.submitted_at).getTime()) / 36e5)
      : 24;
    const approveBase = Deno.env.get('NEXT_PUBLIC_APPROVE_URL') ?? 'https://approve.agri.feerasta.ai';
    for (const userId of recipients) {
      await supabase.schema('zameen').from('notifications').insert({
        recipient_id: userId,
        entity_id: r.entity_id,
        channel: 'in_app',
        category: 'approval_event',
        title: `Reminder: ${r.title} pending ${ageHours}h`,
        body: `Approval is ${ageHours}h old. Amount: PKR ${r.amount_pkr ?? '0'}.`,
        deep_link: `${approveBase}/${r.id}`,
        payload: { approvalRequestId: r.id, event: 'escalation_reminder', ageHours },
      });
      nudged += 1;
    }

    await supabase
      .from('approval_requests')
      .update({ next_escalation_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', r.id);
  }

  return jsonResponse({ nudged });
});
