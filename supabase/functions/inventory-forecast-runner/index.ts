// inventory-forecast-runner
// Schedule: pg_cron daily at 04:00 PKT (23:00 UTC previous day).
//
// For every input with an active reorder_rule:
//   1. Recompute daily velocity from input_issuances over the lookback window.
//   2. Project days-until-stockout using current_stock + pending purchases.
//   3. Compare current_stock against rule.reorder_point.
//   4. Below reorder_point AND auto_create_rfq=true => create an RFQ via the
//      procurement workflow inviting preferred_vendor plus 2 alternates.
//   5. Detect anomalous usage in the last 7 days and persist into
//      inventory_anomalies.
//   6. Notify farm_manager + supervisor (procurement) roles on flags.
//
// Quantities are in the input's native unit. Money in PKR.
// No link to Sentinel or Haazri.

import { getServiceClient, jsonResponse, pktTodayIso, pktAddDays } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

const LOOKBACK_DAYS = 90;
const ANOMALY_WINDOW_DAYS = 7;
const SEASONAL_LOOKBACK_DAYS = 3 * 365;
const DEFAULT_LEAD_TIME_DAYS = 14;

interface InputRow {
  id: string;
  entity_id: string;
  name: string;
  unit: string;
  reorder_point: string | null;
}

interface RuleRow {
  id: string;
  input_id: string;
  rule_kind: string;
  reorder_point: string | null;
  reorder_quantity: string | null;
  safety_stock_days: number;
  preferred_vendor_id: string | null;
  auto_create_rfq: boolean;
  is_active: boolean;
}

interface IssuanceRow {
  input_id: string;
  issued_on: string;
  quantity: string;
}

interface PurchaseRow {
  input_id: string;
  purchased_on: string;
  quantity: string;
  unit_price_pkr: string;
}

function isoAddDays(iso: string, days: number): string {
  return pktAddDays(iso, days);
}

function monthOfIso(iso: string): number {
  return Number(iso.slice(5, 7));
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], mu: number): number {
  if (xs.length < 2) return 0;
  let s = 0;
  for (const x of xs) s += (x - mu) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

function seasonalMultiplier(
  monthlyTotals: Map<string, number>,
  targetMonth: number,
): number {
  if (monthlyTotals.size === 0) return 1;
  let monthSum = 0;
  let monthCount = 0;
  let allSum = 0;
  for (const [key, qty] of monthlyTotals) {
    allSum += qty;
    if (Number(key.split('-')[1]) === targetMonth) {
      monthSum += qty;
      monthCount += 1;
    }
  }
  const overall = allSum / monthlyTotals.size;
  if (overall <= 0 || monthCount === 0) return 1;
  return monthSum / monthCount / overall;
}

Deno.serve(instrument('inventory-forecast-runner', async () => {
  const supabase = getServiceClient();
  const today = pktTodayIso();
  const lookbackStart = isoAddDays(today, -LOOKBACK_DAYS);
  const seasonalStart = isoAddDays(today, -SEASONAL_LOOKBACK_DAYS);
  const anomalyStart = isoAddDays(today, -ANOMALY_WINDOW_DAYS);
  const targetMonth = monthOfIso(today);

  // Active reorder rules.
  const { data: rules, error: rerr } = await supabase
    .from('reorder_rules')
    .select('id, input_id, rule_kind, reorder_point, reorder_quantity, safety_stock_days, preferred_vendor_id, auto_create_rfq, is_active')
    .eq('is_active', true);
  if (rerr) return jsonResponse({ error: rerr.message }, 500);
  const ruleList = (rules ?? []) as RuleRow[];
  if (ruleList.length === 0) return jsonResponse({ forecasts: 0, anomalies: 0, rfqs: 0 });

  const inputIds = Array.from(new Set(ruleList.map((r) => r.input_id)));

  const { data: inputRows } = await supabase
    .from('inputs')
    .select('id, entity_id, name, unit, reorder_point')
    .in('id', inputIds);
  const inputsById = new Map<string, InputRow>((inputRows ?? []).map((i) => [(i as InputRow).id, i as InputRow]));

  // Pull all issuance and purchase history once.
  const { data: issuances } = await supabase
    .from('input_issuances')
    .select('input_id, issued_on, quantity')
    .in('input_id', inputIds)
    .gte('issued_on', seasonalStart);
  const { data: purchases } = await supabase
    .from('input_purchases')
    .select('input_id, purchased_on, quantity, unit_price_pkr')
    .in('input_id', inputIds);

  const issuanceByInput = new Map<string, IssuanceRow[]>();
  for (const r of (issuances ?? []) as IssuanceRow[]) {
    if (!issuanceByInput.has(r.input_id)) issuanceByInput.set(r.input_id, []);
    issuanceByInput.get(r.input_id)!.push(r);
  }
  const purchaseByInput = new Map<string, PurchaseRow[]>();
  for (const r of (purchases ?? []) as PurchaseRow[]) {
    if (!purchaseByInput.has(r.input_id)) purchaseByInput.set(r.input_id, []);
    purchaseByInput.get(r.input_id)!.push(r);
  }

  let forecastCount = 0;
  let anomalyCount = 0;
  let rfqCount = 0;

  for (const rule of ruleList) {
    const inp = inputsById.get(rule.input_id);
    if (!inp) continue;

    const allIssuance = issuanceByInput.get(rule.input_id) ?? [];
    const allPurchases = purchaseByInput.get(rule.input_id) ?? [];

    // Lookback daily series.
    const dayBuckets = new Map<string, number>();
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      dayBuckets.set(isoAddDays(lookbackStart, i), 0);
    }
    for (const r of allIssuance) {
      const d = r.issued_on.slice(0, 10);
      if (!dayBuckets.has(d)) continue;
      dayBuckets.set(d, (dayBuckets.get(d) ?? 0) + Number(r.quantity));
    }
    const series = Array.from(dayBuckets.values());
    const mu = mean(series);
    const sigma = stdDev(series, mu);

    // Seasonal multiplier.
    const monthly = new Map<string, number>();
    for (const r of allIssuance) {
      const key = r.issued_on.slice(0, 7);
      monthly.set(key, (monthly.get(key) ?? 0) + Number(r.quantity));
    }
    const sMult = seasonalMultiplier(monthly, targetMonth);
    const adjustedVelocity = mu * sMult;

    // Stock position.
    let received = 0;
    let pending = 0;
    let lastUnitPrice = 0;
    let lastPurchaseDate = '';
    for (const p of allPurchases) {
      const qty = Number(p.quantity);
      const dt = p.purchased_on.slice(0, 10);
      if (dt > today) pending += qty;
      else received += qty;
      if (dt > lastPurchaseDate) {
        lastPurchaseDate = dt;
        lastUnitPrice = Number(p.unit_price_pkr);
      }
    }
    const issued = allIssuance.reduce((s, r) => s + Number(r.quantity), 0);
    const onHand = received - issued;

    const safetyStockDays = rule.safety_stock_days;
    const usable = onHand + pending - adjustedVelocity * safetyStockDays;
    const daysUntilStockout =
      adjustedVelocity > 0 ? Math.floor(usable / adjustedVelocity) : null;

    // EOQ-style reorder quantity.
    const annualDemand = adjustedVelocity * 365;
    const orderingCost = 5000;
    const holdingCostPerUnit = lastUnitPrice * 0.08;
    let eoq = 0;
    if (annualDemand > 0 && holdingCostPerUnit > 0) {
      eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
    }
    const leadDraw = adjustedVelocity * (DEFAULT_LEAD_TIME_DAYS + safetyStockDays);
    const reorderQty = Number(
      (rule.reorder_quantity ? Number(rule.reorder_quantity) : Math.max(eoq, leadDraw)).toFixed(2),
    );
    const daysOfCover = adjustedVelocity > 0 ? onHand / adjustedVelocity : 9999;
    const fireBy = Math.max(0, Math.floor(daysOfCover - DEFAULT_LEAD_TIME_DAYS - safetyStockDays));
    const reorderByDate = isoAddDays(today, fireBy);

    const payload = {
      lookbackDays: LOOKBACK_DAYS,
      onHand,
      pendingInflow: pending,
      meanDaily: Number(mu.toFixed(4)),
      stdDev: Number(sigma.toFixed(4)),
      seasonalMultiplier: Number(sMult.toFixed(4)),
      adjustedVelocity: Number(adjustedVelocity.toFixed(4)),
      eoq: Number(eoq.toFixed(2)),
      leadTimeDraw: Number(leadDraw.toFixed(2)),
      lastUnitPricePkr: lastUnitPrice,
    };

    await supabase.from('inventory_forecasts').insert({
      input_id: rule.input_id,
      current_stock: onHand.toFixed(4),
      daily_velocity: adjustedVelocity.toFixed(4),
      std_dev: sigma.toFixed(4),
      days_until_stockout: daysUntilStockout,
      recommended_reorder_quantity: reorderQty.toString(),
      recommended_reorder_by_date: reorderByDate,
      forecast_horizon_days: 90,
      forecast_payload: payload,
    });
    forecastCount += 1;

    // Anomaly detection (last 7 days).
    if (series.length >= 14 && sigma > 0) {
      const highCutoff = mu + 3 * sigma;
      const daysWithUsage = series.filter((v) => v > 0).length;
      const usageRate = daysWithUsage / series.length;
      for (let i = 0; i < ANOMALY_WINDOW_DAYS; i++) {
        const day = isoAddDays(anomalyStart, i);
        const qtyForDay = (dayBuckets.get(day) ?? 0);
        let kind: string | null = null;
        if (qtyForDay > highCutoff) kind = 'unusual_high_usage';
        else if (qtyForDay === 0 && usageRate > 0.5 && mu > 0) kind = 'unusual_low_usage';
        if (!kind) continue;

        const { data: existing } = await supabase
          .from('inventory_anomalies')
          .select('id')
          .eq('input_id', rule.input_id)
          .eq('detected_on', day)
          .eq('anomaly_kind', kind)
          .limit(1);
        if (existing && existing.length > 0) continue;

        const dev = sigma > 0 ? (qtyForDay - mu) / sigma : 0;
        await supabase.from('inventory_anomalies').insert({
          input_id: rule.input_id,
          detected_on: day,
          observed_quantity: qtyForDay.toFixed(4),
          expected_quantity: mu.toFixed(4),
          std_dev_away: dev.toFixed(2),
          anomaly_kind: kind,
        });
        anomalyCount += 1;
      }
    }

    // Stockout anomaly.
    if (onHand <= 0) {
      const { data: existing } = await supabase
        .from('inventory_anomalies')
        .select('id')
        .eq('input_id', rule.input_id)
        .eq('detected_on', today)
        .eq('anomaly_kind', 'stockout')
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from('inventory_anomalies').insert({
          input_id: rule.input_id,
          detected_on: today,
          observed_quantity: onHand.toFixed(4),
          expected_quantity: mu.toFixed(4),
          std_dev_away: '0',
          anomaly_kind: 'stockout',
        });
        anomalyCount += 1;
      }
    }

    // Reorder trigger.
    const reorderPoint = rule.reorder_point != null ? Number(rule.reorder_point) : null;
    const belowReorder = reorderPoint != null && onHand <= reorderPoint;

    if (belowReorder && rule.auto_create_rfq) {
      const { data: rfqExisting } = await supabase
        .from('rfqs')
        .select('id')
        .eq('input_id', rule.input_id)
        .eq('status', 'open')
        .limit(1);
      if (!rfqExisting || rfqExisting.length === 0) {
        const altVendors: string[] = [];
        if (rule.preferred_vendor_id) altVendors.push(rule.preferred_vendor_id);
        const { data: vendorCandidates } = await supabase
          .from('vendors')
          .select('id')
          .eq('entity_id', inp.entity_id)
          .limit(3);
        for (const v of vendorCandidates ?? []) {
          if (!altVendors.includes((v as { id: string }).id)) altVendors.push((v as { id: string }).id);
          if (altVendors.length >= 3) break;
        }
        const { data: rfqRow } = await supabase
          .from('rfqs')
          .insert({
            entity_id: inp.entity_id,
            input_id: rule.input_id,
            quantity: reorderQty.toString(),
            unit: inp.unit,
            needed_by: reorderByDate,
            status: 'open',
            invited_vendor_ids: altVendors,
            origin: 'auto_reorder',
            notes: `Auto-created: on-hand ${onHand.toFixed(2)} <= reorder point ${reorderPoint}.`,
          })
          .select('id')
          .single();
        if (rfqRow) rfqCount += 1;
      }
    }

    // Notifications when below reorder point or stockout risk soon.
    if (belowReorder || (daysUntilStockout != null && daysUntilStockout <= 7)) {
      const { data: managers } = await supabase
        .from('user_entity_roles')
        .select('user_id, role')
        .eq('entity_id', inp.entity_id)
        .in('role', ['farm_manager', 'supervisor', 'director'])
        .eq('is_active', true);
      for (const m of managers ?? []) {
        await supabase.from('notifications').insert({
          recipient_id: (m as { user_id: string }).user_id,
          entity_id: inp.entity_id,
          channel: 'whatsapp',
          category: 'inventory_reorder',
          title: belowReorder
            ? `Reorder ${inp.name}: on-hand ${onHand.toFixed(1)} ${inp.unit}`
            : `Stockout risk: ${inp.name} in ${daysUntilStockout} days`,
          body: `Recommended order ${reorderQty.toFixed(1)} ${inp.unit} by ${reorderByDate}.`,
          payload: { inputId: rule.input_id, reorderQty, reorderByDate, daysUntilStockout },
        });
      }
    }
  }

  return jsonResponse({ forecasts: forecastCount, anomalies: anomalyCount, rfqs: rfqCount });
}));
