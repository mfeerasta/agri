// scheduled-report-deliverer
// Schedule: every 5 minutes via pg_cron.
// Walks zameen.scheduled_report_deliveries, evaluates the schedule_cron,
// renders the linked report's last snapshot (or runs a fresh execution),
// then dispatches via the appropriate channel.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

interface Delivery {
  id: string;
  report_id: string;
  recipients: { kind: 'email' | 'whatsapp' | 'user'; value: string }[];
  delivery_format: 'email_pdf' | 'email_xlsx' | 'whatsapp_summary' | 'dashboard_embed';
  schedule_cron: string;
  last_delivered_at: string | null;
  is_active: boolean;
}

// minimal cron matcher: supports `m h dom mon dow` with `*` and exact ints.
function cronDue(cron: string, last: Date | null, now: Date): boolean {
  const [m, h, dom, mon, dow] = cron.trim().split(/\s+/);
  if (!m || !h || !dom || !mon || !dow) return false;
  const matches = (field: string, val: number) => field === '*' || Number(field) === val;
  const due =
    matches(m, now.getUTCMinutes()) &&
    matches(h, now.getUTCHours()) &&
    matches(dom, now.getUTCDate()) &&
    matches(mon, now.getUTCMonth() + 1) &&
    matches(dow, now.getUTCDay());
  if (!due) return false;
  if (last && now.getTime() - last.getTime() < 60_000) return false;
  return true;
}

async function dispatch(
  client: ReturnType<typeof getServiceClient>,
  d: Delivery,
  snapshot: unknown,
): Promise<void> {
  // notification dispatcher already exists for digests + alerts. we enqueue
  // a row in the existing channel that handles email/whatsapp dispatch
  // rather than duplicating SMTP wiring here.
  for (const r of d.recipients) {
    await client.from('notification_queue').insert({
      channel: r.kind === 'whatsapp' ? 'whatsapp' : 'email',
      target: r.value,
      kind: `report:${d.delivery_format}`,
      payload: { reportId: d.report_id, snapshot },
    });
  }
}

Deno.serve(async () => {
  const client = getServiceClient();
  const now = new Date();
  const { data, error } = await client
    .from('scheduled_report_deliveries')
    .select('*')
    .eq('is_active', true);
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);

  const rows = (data ?? []) as Delivery[];
  let delivered = 0;
  for (const d of rows) {
    const last = d.last_delivered_at ? new Date(d.last_delivered_at) : null;
    if (!cronDue(d.schedule_cron, last, now)) continue;

    const { data: exec } = await client
      .from('report_executions')
      .select('result_snapshot')
      .eq('report_id', d.report_id)
      .order('executed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    await dispatch(client, d, exec?.result_snapshot ?? null);
    await client
      .from('scheduled_report_deliveries')
      .update({ last_delivered_at: now.toISOString() })
      .eq('id', d.id);
    delivered += 1;
  }

  return jsonResponse({ ok: true, scanned: rows.length, delivered });
});
