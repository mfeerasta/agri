// ar-aging-checker
// Schedule: pg_cron daily 09:00 PKT (04:00 UTC).
// 1. Flips invoices past due_date to status='overdue'.
// 2. Fires WhatsApp/email/SMS reminders at T+1, T+7, T+15, T+30, T+45, T+60 day buckets.
// 3. Notifies finance team for any account aged > 90 days.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface ArInvoiceRow {
  id: string;
  entity_id: string;
  buyer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  outstanding_pkr: string;
  status: string;
}

const REMINDER_DAYS = [1, 7, 15, 30, 45, 60];
const FINANCE_TEAM_THRESHOLD_DAYS = 90;

function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}

Deno.serve(
  instrument('ar-aging-checker', async () => {
    const supabase = getServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Flip past-due open/partial to 'overdue'.
    const { data: pastDue, error: pdErr } = await supabase
      .from('ar_invoices')
      .select('id, entity_id, buyer_id, invoice_number, invoice_date, due_date, outstanding_pkr, status')
      .in('status', ['open', 'partial'])
      .lt('due_date', today);
    if (pdErr) return jsonResponse({ error: pdErr.message }, 500);
    const pastDueRows = (pastDue ?? []) as ArInvoiceRow[];

    let flipped = 0;
    for (const inv of pastDueRows) {
      const { error } = await supabase.from('ar_invoices').update({ status: 'overdue' }).eq('id', inv.id);
      if (!error) flipped += 1;
    }

    // 2. Pull all outstanding invoices and fire reminders.
    const { data: outstanding, error: oErr } = await supabase
      .from('ar_invoices')
      .select('id, entity_id, buyer_id, invoice_number, invoice_date, due_date, outstanding_pkr, status')
      .in('status', ['open', 'partial', 'overdue', 'disputed']);
    if (oErr) return jsonResponse({ error: oErr.message }, 500);
    const rows = (outstanding ?? []) as ArInvoiceRow[];

    let remindersSent = 0;
    let financeAlerts = 0;
    const ninetyPlusByEntity = new Map<string, number>();

    for (const inv of rows) {
      const dso = daysBetween(inv.due_date, today);
      if (dso > 0 && REMINDER_DAYS.includes(dso)) {
        // notify-dispatch is the unified notifier in this codebase
        await supabase.functions
          .invoke('notify-dispatch', {
            body: {
              kind: 'ar_payment_reminder',
              entityId: inv.entity_id,
              buyerId: inv.buyer_id,
              channels: ['whatsapp', 'email', 'sms'],
              data: {
                invoiceNumber: inv.invoice_number,
                outstandingPkr: inv.outstanding_pkr,
                dueDate: inv.due_date,
                daysOverdue: dso,
              },
            },
          })
          .catch(() => null);
        remindersSent += 1;
      }
      if (dso > FINANCE_TEAM_THRESHOLD_DAYS) {
        ninetyPlusByEntity.set(
          inv.entity_id,
          (ninetyPlusByEntity.get(inv.entity_id) ?? 0) + Number(inv.outstanding_pkr),
        );
      }
    }

    for (const [entityId, totalPkr] of ninetyPlusByEntity.entries()) {
      await supabase.functions
        .invoke('notify-dispatch', {
          body: {
            kind: 'ar_aging_finance_alert',
            entityId,
            channels: ['email', 'whatsapp'],
            data: { totalOver90dPkr: totalPkr.toFixed(2), asOfDate: today },
          },
        })
        .catch(() => null);
      financeAlerts += 1;
    }

    return jsonResponse({ ok: true, flipped, remindersSent, financeAlerts, asOf: today });
  }),
);
