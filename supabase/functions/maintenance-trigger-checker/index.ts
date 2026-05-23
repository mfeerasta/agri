// maintenance-trigger-checker
// Schedule: pg_cron daily at 06:00 PKT.
// Walks every active row in zameen.maintenance_plans, evaluates the trigger
// (hour-meter, days-elapsed, calendar-date, condition-based) and, when due,
//   1. updates next_due_at on the plan,
//   2. inserts an in-app notification for the asset operator + farm manager,
//   3. auto-opens a `preventive_maintenance` approval request when the
//      estimated cost exceeds the supervisor threshold (5,000 PKR default).

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface PlanRow {
  id: string;
  asset_id: string;
  name: string;
  trigger_kind: string;
  trigger_value: string | null;
  estimated_cost_pkr: string | null;
  next_due_at: string | null;
  last_executed_at: string | null;
  created_at: string;
}

interface AssetRow {
  id: string;
  code: string;
  entity_id: string;
  current_hour_meter: string | null;
}

const SUPERVISOR_THRESHOLD_PKR = 5_000;

Deno.serve(instrument('maintenance-trigger-checker', async () => {
  const supabase = getServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: plans, error: planErr } = await supabase
    .schema('zameen')
    .from('maintenance_plans')
    .select('id, asset_id, name, trigger_kind, trigger_value, estimated_cost_pkr, next_due_at, last_executed_at, created_at')
    .eq('is_active', true);
  if (planErr) throw planErr;

  const due: Array<{ planId: string; assetId: string; reason: string; estPkr: number }> = [];

  for (const p of (plans ?? []) as PlanRow[]) {
    const { data: asset } = await supabase
      .schema('zameen')
      .from('assets')
      .select('id, code, entity_id, current_hour_meter')
      .eq('id', p.asset_id)
      .single();
    if (!asset) continue;
    const a = asset as AssetRow;
    const trig = Number(p.trigger_value ?? 0);
    let isDue = false;
    let reason = '';

    if (p.trigger_kind === 'hour_meter' && trig > 0) {
      const { data: last } = await supabase
        .schema('zameen')
        .from('maintenance_executions')
        .select('hour_meter_at_service')
        .eq('plan_id', p.id)
        .order('executed_on', { ascending: false })
        .limit(1)
        .maybeSingle();
      const baseline = Number(last?.hour_meter_at_service ?? 0);
      const current = Number(a.current_hour_meter ?? 0);
      const delta = current - baseline;
      if (delta >= trig) {
        isDue = true;
        reason = `${delta.toFixed(0)}h since last service (every ${trig}h)`;
      }
    } else if (p.trigger_kind === 'days_elapsed' && trig > 0) {
      const base = p.last_executed_at ?? p.created_at;
      const days = Math.floor((now.getTime() - new Date(base).getTime()) / 86_400_000);
      if (days >= trig) {
        isDue = true;
        reason = `${days}d since last service (every ${trig}d)`;
      }
    } else if (p.trigger_kind === 'calendar_date' && p.next_due_at) {
      if (new Date(p.next_due_at).getTime() <= now.getTime()) {
        isDue = true;
        reason = 'scheduled date reached';
      }
    } else if (p.trigger_kind === 'condition_based') {
      const { count } = await supabase
        .schema('zameen')
        .from('diesel_anomalies')
        .select('id', { count: 'exact', head: true })
        .eq('asset_id', p.asset_id)
        .eq('status', 'open');
      if ((count ?? 0) > 0) {
        isDue = true;
        reason = `${count} open fuel anomaly flag(s)`;
      }
    }

    if (!isDue) continue;

    await supabase
      .schema('zameen')
      .from('maintenance_plans')
      .update({ next_due_at: nowIso })
      .eq('id', p.id);

    const estPkr = Number(p.estimated_cost_pkr ?? 0);
    due.push({ planId: p.id, assetId: p.asset_id, reason, estPkr });

    // Notify operators + farm managers for this entity.
    await supabase
      .schema('zameen')
      .from('notifications')
      .insert({
        entity_id: a.entity_id,
        kind: 'maintenance_due',
        title: `Maintenance due: ${a.code} — ${p.name}`,
        body: reason,
        link: `/assets/${a.id}/maintenance`,
      })
      .select();

    // Auto-create approval when above supervisor threshold.
    if (estPkr >= SUPERVISOR_THRESHOLD_PKR) {
      await supabase
        .schema('zameen')
        .from('approval_requests')
        .insert({
          entity_id: a.entity_id,
          approval_type: 'preventive_maintenance',
          source_module: 'maintenance',
          source_record_id: p.id,
          title: `Preventive maintenance — ${a.code} — ${p.name}`,
          amount_pkr: estPkr.toString(),
          state: 'submitted',
          payload: { planId: p.id, assetId: a.id, reason, estimatedCostPkr: estPkr },
        });
    }
  }

  return jsonResponse({ ok: true, dueCount: due.length, due });
}));
