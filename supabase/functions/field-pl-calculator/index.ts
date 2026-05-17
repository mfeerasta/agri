// field-pl-calculator
// Schedule: pg_cron weekly Sunday 02:00 PKT.
// Walks every active crop_plan and computes per-field P&L, caching the result
// in zameen.field_pnl_cache (one row per (field_id, season_label)). The cache
// table is created in migration 0007_rpc_functions.sql.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

import { instrument } from '../_shared/instrumented.ts';
interface CropPlanRow {
  id: string;
  field_id: string;
  entity_id: string;
  season_label: string;
  planned_acres: string;
  variety_name: string | null;
}

interface CostAllocRow {
  cost_pool: string;
  amount_pkr: string;
}

Deno.serve(instrument('field-pl-calculator', async () => {
  const supabase = getServiceClient();

  const { data: plansRaw, error } = await supabase
    .from('crop_plans')
    .select('id, field_id, season_label, planned_acres, variety_name, fields!inner(blocks!inner(farms!inner(entity_id)))');
  if (error) return jsonResponse({ error: error.message }, 500);
  type RowWithJoin = CropPlanRow & { fields?: { blocks?: { farms?: { entity_id?: string } } } };
  const plans = (plansRaw ?? []) as unknown as RowWithJoin[];

  let written = 0;
  for (const plan of plans) {
    const entityId = plan.fields?.blocks?.farms?.entity_id ?? plan.entity_id;
    const { data: allocs } = await supabase
      .from('cost_allocations')
      .select('cost_pool, amount_pkr')
      .eq('crop_plan_id', plan.id);
    const costByPool: Record<string, number> = {};
    let totalCost = 0;
    for (const a of (allocs ?? []) as CostAllocRow[]) {
      const amt = Number(a.amount_pkr);
      costByPool[a.cost_pool] = (costByPool[a.cost_pool] ?? 0) + amt;
      totalCost += amt;
    }

    const { data: harvests } = await supabase
      .from('harvest_records')
      .select('gross_yield_kg, acres_harvested')
      .eq('crop_plan_id', plan.id);
    const yieldKg = (harvests ?? []).reduce((s, h) => s + Number(h.gross_yield_kg), 0);

    const { data: lots } = await supabase
      .from('produce_lots')
      .select('id')
      .eq('crop_plan_id', plan.id);
    const lotIds = (lots ?? []).map((l) => l.id);
    let revenuePkr = 0;
    if (lotIds.length > 0) {
      const { data: dispatches } = await supabase
        .from('mandi_dispatches')
        .select('id')
        .in('produce_lot_id', lotIds);
      const dispatchIds = (dispatches ?? []).map((d) => d.id);
      if (dispatchIds.length > 0) {
        const { data: settlements } = await supabase
          .from('mandi_settlements')
          .select('net_received_pkr')
          .in('mandi_dispatch_id', dispatchIds);
        revenuePkr = (settlements ?? []).reduce((s, x) => s + Number(x.net_received_pkr), 0);
      }
    }

    const acres = Number(plan.planned_acres);
    const grossMargin = revenuePkr - totalCost;

    const cachePayload = {
      field_id: plan.field_id,
      crop_plan_id: plan.id,
      entity_id: entityId,
      season_label: plan.season_label,
      variety_name: plan.variety_name,
      acres,
      revenue_pkr: revenuePkr.toFixed(2),
      total_cost_pkr: totalCost.toFixed(2),
      cost_by_pool: costByPool,
      gross_margin_pkr: grossMargin.toFixed(2),
      margin_per_acre_pkr: acres > 0 ? (grossMargin / acres).toFixed(2) : '0',
      yield_kg: yieldKg.toFixed(2),
      yield_per_acre_kg: acres > 0 ? (yieldKg / acres).toFixed(2) : '0',
      computed_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from('field_pnl_cache')
      .upsert(cachePayload, { onConflict: 'field_id,season_label' });
    if (!upErr) written += 1;
  }

  return jsonResponse({ written });
}));
