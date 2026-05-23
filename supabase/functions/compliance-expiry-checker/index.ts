// compliance-expiry-checker
// Schedule: pg_cron daily at 06:00 PKT.
// Scans zameen.compliance_documents for active rows with an expires_on date,
// fires in-app notifications at T-90, T-60, T-30, T-7, T-0, and flips status
// to 'expired' once expires_on is in the past.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface DocRow {
  id: string;
  entity_id: string;
  doc_kind: string;
  title: string;
  reference_number: string | null;
  expires_on: string;
  status: string;
}

const WINDOWS = [90, 60, 30, 7, 0] as const;

Deno.serve(instrument('compliance-expiry-checker', async () => {
  const supabase = getServiceClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Step 1: mark already-lapsed rows expired.
  const { data: lapsed, error: lapsedErr } = await supabase
    .schema('zameen')
    .from('compliance_documents')
    .select('id, entity_id, doc_kind, title, reference_number, expires_on, status')
    .eq('status', 'active')
    .lt('expires_on', todayIso);
  if (lapsedErr) return jsonResponse({ error: lapsedErr.message }, 500);

  let expired = 0;
  for (const d of (lapsed ?? []) as DocRow[]) {
    const { error: upErr } = await supabase
      .schema('zameen')
      .from('compliance_documents')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', d.id);
    if (!upErr) expired += 1;
  }

  // Step 2: per-window notifications. We fire exactly when expires_on === today + window.
  let notified = 0;
  for (const days of WINDOWS) {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + days);
    const targetIso = target.toISOString().slice(0, 10);
    const { data: due, error: dueErr } = await supabase
      .schema('zameen')
      .from('compliance_documents')
      .select('id, entity_id, doc_kind, title, reference_number, expires_on, status')
      .eq('status', 'active')
      .eq('expires_on', targetIso);
    if (dueErr) continue;

    for (const d of (due ?? []) as DocRow[]) {
      const { data: directors } = await supabase
        .from('user_entity_roles')
        .select('user_id')
        .eq('entity_id', d.entity_id)
        .eq('role', 'director')
        .eq('is_active', true);
      const title = days === 0
        ? `${d.title} expires today`
        : `${d.title} lapses in ${days}d`;
      const body = `${d.doc_kind} ${d.reference_number ?? ''} on file expires ${d.expires_on}. Start renewal.`.trim();
      for (const r of directors ?? []) {
        await supabase.schema('zameen').from('notifications').insert({
          recipient_id: r.user_id,
          entity_id: d.entity_id,
          channel: 'in_app',
          category: 'compliance_expiry',
          title,
          body,
          deep_link: `/compliance/documents/${d.id}`,
          payload: { docId: d.id, daysLeft: days, docKind: d.doc_kind },
        });
        notified += 1;
      }
    }
  }

  return jsonResponse({ expired, notified });
}));
