// stakeholder-report-due-checker
// Schedule: pg_cron daily 09:00 PKT (04:00 UTC).
// Walks zameen.stakeholders.next_report_due and emits alerts at T-7, T-3, T-1,
// T+0, and T+overdue. Also flips zameen.stakeholder_reports.status to
// 'overdue' for past-due rows still in draft/review.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface StakeholderRow {
  id: string;
  entity_id: string;
  name: string;
  stakeholder_kind: string;
  email: string | null;
  contact_person: string | null;
  next_report_due: string | null;
  reporting_frequency: string;
}

const ALERT_OFFSETS = [-7, -3, -1, 0];

function daysDiff(target: string, today: string): number {
  return Math.round((new Date(target).getTime() - new Date(today).getTime()) / 86_400_000);
}

Deno.serve(
  instrument('stakeholder-report-due-checker', async () => {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: list, error } = await supabase
      .schema('zameen')
      .from('stakeholders')
      .select('id, entity_id, name, stakeholder_kind, email, contact_person, next_report_due, reporting_frequency')
      .eq('is_active', true)
      .not('next_report_due', 'is', null);
    if (error) return jsonResponse({ error: error.message }, 500);

    const rows = (list ?? []) as StakeholderRow[];
    const alerts: Array<{ stakeholderId: string; kind: string; offsetDays: number }> = [];

    for (const r of rows) {
      if (!r.next_report_due) continue;
      const delta = daysDiff(r.next_report_due, today);
      if (ALERT_OFFSETS.includes(delta)) {
        alerts.push({ stakeholderId: r.id, kind: 'pre-due', offsetDays: delta });
      } else if (delta < -1) {
        alerts.push({ stakeholderId: r.id, kind: 'overdue', offsetDays: delta });
      }
    }

    // Mark past-due draft/review reports as overdue.
    const { error: flipErr } = await supabase
      .schema('zameen')
      .from('stakeholder_reports')
      .update({ status: 'overdue' })
      .lt('due_date', today)
      .in('status', ['draft', 'review']);
    if (flipErr) return jsonResponse({ error: flipErr.message }, 500);

    // Persist activity rows so the ops dashboard can surface alerts. Actual
    // WhatsApp/email dispatch is handled by the digest-sender / notify
    // pipeline that subscribes to entity_activity.
    if (alerts.length > 0) {
      const activityRows = alerts.map((a) => ({
        entity_kind: 'stakeholder',
        entity_id: a.stakeholderId,
        kind:
          a.offsetDays >= 0 && a.offsetDays !== -1
            ? `stakeholder.report.due-t${a.offsetDays >= 0 ? 'plus' : 'minus'}${Math.abs(a.offsetDays)}`
            : `stakeholder.report.${a.kind}`,
        payload: { offsetDays: a.offsetDays },
        occurred_at: new Date().toISOString(),
      }));
      const { error: actErr } = await supabase.schema('zameen').from('entity_activity').insert(activityRows);
      if (actErr) return jsonResponse({ error: actErr.message }, 500);
    }

    return jsonResponse({ ok: true, alerts: alerts.length, scanned: rows.length });
  }),
);
