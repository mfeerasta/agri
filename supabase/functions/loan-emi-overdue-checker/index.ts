// loan-emi-overdue-checker
// Schedule: pg_cron daily at 08:00 PKT.
// Marks scheduled EMIs past their due_on as overdue and notifies the finance
// team and director for each affected loan.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface OverdueRow {
  id: string;
  loan_id: string;
  installment_number: number;
  due_on: string;
  total_pkr: string;
}

interface LoanLite {
  id: string;
  entity_id: string;
  lender_name: string;
  loan_number: string | null;
}

Deno.serve(instrument('loan-emi-overdue-checker', async () => {
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: stale, error } = await supabase
    .schema('zameen')
    .from('loan_emi_schedules')
    .select('id, loan_id, installment_number, due_on, total_pkr')
    .eq('status', 'scheduled')
    .lt('due_on', today);
  if (error) return jsonResponse({ error: error.message }, 500);

  const rows = (stale ?? []) as OverdueRow[];
  if (rows.length === 0) return jsonResponse({ marked: 0, notified: 0, processed: 0 });

  const ids = rows.map((r) => r.id);
  await supabase
    .schema('zameen')
    .from('loan_emi_schedules')
    .update({ status: 'overdue' })
    .in('id', ids);

  // Group by loan and notify
  const byLoan = new Map<string, OverdueRow[]>();
  for (const r of rows) {
    const list = byLoan.get(r.loan_id) ?? [];
    list.push(r);
    byLoan.set(r.loan_id, list);
  }

  let notified = 0;
  for (const [loanId, emis] of byLoan.entries()) {
    const { data: loanRows } = await supabase
      .schema('zameen')
      .from('crop_loans')
      .select('id, entity_id, lender_name, loan_number')
      .eq('id', loanId)
      .limit(1);
    const loan = (loanRows ?? [])[0] as LoanLite | undefined;
    if (!loan) continue;

    const totalOverdue = emis.reduce((s, e) => s + Number(e.total_pkr), 0);

    const { data: recipients } = await supabase
      .from('user_entity_roles')
      .select('user_id, role')
      .eq('entity_id', loan.entity_id)
      .in('role', ['director', 'accountant', 'farm_manager'])
      .eq('is_active', true);

    for (const r of recipients ?? []) {
      await supabase.schema('zameen').from('notifications').insert({
        recipient_id: r.user_id,
        entity_id: loan.entity_id,
        channel: 'in_app',
        category: 'loan_emi_overdue',
        title: `Loan ${loan.lender_name} EMI overdue`,
        body: `${emis.length} installment${emis.length === 1 ? '' : 's'} past due. Total Rs ${totalOverdue.toFixed(0)}.`,
        deep_link: `/finance/loans/${loanId}`,
        payload: { loanId, emiIds: emis.map((e) => e.id), totalOverduePkr: totalOverdue },
      });
      notified += 1;
    }
  }

  return jsonResponse({ marked: rows.length, notified, processed: rows.length });
}));
