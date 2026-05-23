// tax-due-checker
// Schedule: pg_cron daily at 06:30 PKT.
// Scans zameen.tax_periods for filings still pending or prepared. Fires
// in-app notifications at T-30, T-14, T-7, T-3, T-1, T-0 and continues daily
// once a filing is overdue. Also flips filing_status to 'overdue' for any
// past-due record that is still pending/prepared.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface PeriodRow {
  id: string;
  entity_id: string;
  tax_kind: string;
  period_start: string;
  period_end: string;
  due_on: string;
  filing_status: string;
  computed_amount_pkr: string | null;
}

const PRE_DUE = [30, 14, 7, 3, 1, 0] as const;

Deno.serve(instrument('tax-due-checker', async () => {
  const supabase = getServiceClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // Mark past-due pending/prepared as overdue.
  const { data: lapsed } = await supabase
    .schema('zameen')
    .from('tax_periods')
    .select('id, entity_id, tax_kind, period_start, period_end, due_on, filing_status, computed_amount_pkr')
    .in('filing_status', ['pending', 'prepared'])
    .lt('due_on', todayIso);
  let flippedOverdue = 0;
  for (const r of (lapsed ?? []) as PeriodRow[]) {
    await supabase.schema('zameen').from('tax_periods')
      .update({ filing_status: 'overdue', updated_at: new Date().toISOString() })
      .eq('id', r.id);
    flippedOverdue += 1;
  }

  // Pre-due nudges at exact T-N hits.
  let notified = 0;
  for (const days of PRE_DUE) {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + days);
    const targetIso = target.toISOString().slice(0, 10);
    const { data: due } = await supabase
      .schema('zameen')
      .from('tax_periods')
      .select('id, entity_id, tax_kind, period_start, period_end, due_on, filing_status, computed_amount_pkr')
      .in('filing_status', ['pending', 'prepared'])
      .eq('due_on', targetIso);
    for (const r of (due ?? []) as PeriodRow[]) {
      await notifyDirectors(supabase, r, days, false);
      notified += 1;
    }
  }

  // Post-due daily nudge for anything still unpaid.
  const { data: overdue } = await supabase
    .schema('zameen')
    .from('tax_periods')
    .select('id, entity_id, tax_kind, period_start, period_end, due_on, filing_status, computed_amount_pkr')
    .eq('filing_status', 'overdue');
  let overdueNudged = 0;
  for (const r of (overdue ?? []) as PeriodRow[]) {
    const daysPast = Math.floor((new Date(todayIso).getTime() - new Date(r.due_on).getTime()) / (1000 * 60 * 60 * 24));
    await notifyDirectors(supabase, r, -daysPast, true);
    overdueNudged += 1;
  }

  return jsonResponse({ flippedOverdue, notified, overdueNudged });
}));

async function notifyDirectors(
  supabase: ReturnType<typeof getServiceClient>,
  r: PeriodRow,
  days: number,
  isOverdue: boolean,
): Promise<void> {
  const { data: directors } = await supabase
    .from('user_entity_roles')
    .select('user_id')
    .eq('entity_id', r.entity_id)
    .eq('role', 'director')
    .eq('is_active', true);
  const title = isOverdue
    ? `${r.tax_kind} overdue by ${Math.abs(days)}d`
    : days === 0
      ? `${r.tax_kind} due today`
      : `${r.tax_kind} due in ${days}d`;
  const body = `Period ${r.period_start} to ${r.period_end} closes ${r.due_on}. Computed ${r.computed_amount_pkr ?? '0'} PKR.`;
  for (const d of directors ?? []) {
    await supabase.schema('zameen').from('notifications').insert({
      recipient_id: d.user_id,
      entity_id: r.entity_id,
      channel: 'in_app',
      category: 'tax_due',
      title,
      body,
      deep_link: `/finance/tax/periods?kind=${r.tax_kind}`,
      payload: { taxPeriodId: r.id, daysLeft: days, taxKind: r.tax_kind },
    });
  }
}
