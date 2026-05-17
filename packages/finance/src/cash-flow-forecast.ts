/**
 * Rolling cash-flow forecast.
 *
 * The platform's go/no-go signal: any day where projected running balance
 * dips below zero (or below `entity_settings.cash_floor`) is surfaced as a
 * cash-gap warning. Approvers see this in their context snapshot so they
 * can reject discretionary spend that would push the entity dry.
 */

import { and, eq, gte, lte, sql as dsql } from 'drizzle-orm';
import {
  db,
  accounts,
  journalLines,
  journalEntries,
  purchaseInvoices,
  payrollRuns,
  tasks,
  mandiSettlements,
  mandiDispatches,
  entitySettings,
  cashFlowForecasts,
} from '@zameen/db';

export interface CashFlowRow {
  date: string;
  inflowPkr: number;
  outflowPkr: number;
  runningBalancePkr: number;
}

export interface CashGapWarning {
  date: string;
  runningBalancePkr: number;
  floorPkr: number;
  reason: 'below_zero' | 'below_floor';
}

export interface CashFlowForecast {
  entityId: string;
  generatedOn: string;
  horizonDays: number;
  openingPkr: number;
  rows: CashFlowRow[];
  warnings: CashGapWarning[];
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute and persist a 90-day forecast for an entity. Persistence lets the
 * Approver PWA pull the latest snapshot without recomputing on every render.
 */
export async function computeCashFlowForecast({
  entityId,
  horizonDays = 90,
}: {
  entityId: string;
  horizonDays?: number;
}): Promise<CashFlowForecast> {
  const today = new Date();
  const horizonEnd = addDays(today, horizonDays);

  // Opening cash: net balance of all asset accounts of type cash/bank.
  const acctRows = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
  const cashAcctIds = acctRows.filter((a) => a.accountType === 'cash' || a.accountType === 'bank').map((a) => a.id);

  let openingPkr = 0;
  if (cashAcctIds.length > 0) {
    const lines = await db
      .select({
        accountId: journalLines.accountId,
        debit: dsql<string>`sum(${journalLines.debitPkr})`,
        credit: dsql<string>`sum(${journalLines.creditPkr})`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalEntries.entityId, entityId), lte(journalEntries.postedOn, isoDay(today))))
      .groupBy(journalLines.accountId);
    for (const l of lines) {
      if (cashAcctIds.includes(l.accountId)) {
        openingPkr += Number(l.debit ?? 0) - Number(l.credit ?? 0);
      }
    }
  }

  // Pre-bucket inflows and outflows per day.
  const buckets = new Map<string, { inflow: number; outflow: number }>();
  for (let i = 0; i < horizonDays; i++) {
    buckets.set(isoDay(addDays(today, i)), { inflow: 0, outflow: 0 });
  }

  // Outflows: unpaid purchase invoices by due date (or today if overdue).
  const invs = await db
    .select()
    .from(purchaseInvoices)
    .where(and(eq(purchaseInvoices.entityId, entityId), eq(purchaseInvoices.status, 'open')));
  for (const inv of invs) {
    const due = inv.dueDate ?? isoDay(today);
    const remaining = Number(inv.totalPkr) - Number(inv.paidPkr);
    if (remaining <= 0) continue;
    const day = due < isoDay(today) ? isoDay(today) : due;
    const b = buckets.get(day);
    if (b) b.outflow += remaining;
  }

  // Outflows: scheduled payroll runs.
  const payrolls = await db
    .select()
    .from(payrollRuns)
    .where(
      and(eq(payrollRuns.entityId, entityId), gte(payrollRuns.periodEnd, isoDay(today)), lte(payrollRuns.periodEnd, isoDay(horizonEnd))),
    );
  for (const p of payrolls) {
    const b = buckets.get(p.periodEnd);
    if (b) b.outflow += Number(p.totalPkr);
  }

  // Outflows: planned task costs (estimated_hours * default rate of 800 PKR/hr).
  const DEFAULT_HOURLY_PKR = 800;
  const taskRows = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.entityId, entityId), gte(tasks.scheduledFor, isoDay(today)), lte(tasks.scheduledFor, isoDay(horizonEnd))),
    );
  for (const t of taskRows) {
    if (!t.scheduledFor || !t.estimatedHours) continue;
    const b = buckets.get(t.scheduledFor);
    if (b) b.outflow += Number(t.estimatedHours) * DEFAULT_HOURLY_PKR;
  }

  // Inflows: pending mandi settlements (dispatched but not yet settled, projected for tomorrow).
  const dispatched = await db
    .select()
    .from(mandiDispatches)
    .where(and(eq(mandiDispatches.entityId, entityId), eq(mandiDispatches.status, 'dispatched')));
  // Estimate gross at PKR 5000/quintal * net weight kg / 100 if no settlement (placeholder).
  for (const d of dispatched) {
    const estimatePkr = (Number(d.netWeightKg) / 100) * 5000;
    const target = isoDay(addDays(today, 2));
    const b = buckets.get(target);
    if (b) b.inflow += estimatePkr;
  }

  // Inflows: unsettled mandi settlements expected on settledOn date.
  const settlements = await db
    .select()
    .from(mandiSettlements)
    .where(and(gte(mandiSettlements.settledOn, isoDay(today)), lte(mandiSettlements.settledOn, isoDay(horizonEnd))));
  for (const s of settlements) {
    const b = buckets.get(s.settledOn);
    if (b) b.inflow += Number(s.netReceivedPkr);
  }

  // Read cash floor.
  const [settings] = await db.select().from(entitySettings).where(eq(entitySettings.entityId, entityId)).limit(1);
  const floorPkr = Number((settings?.unitsConfig as { cashFloorPkr?: number } | undefined)?.cashFloorPkr ?? 0);

  // Roll up.
  const rows: CashFlowRow[] = [];
  const warnings: CashGapWarning[] = [];
  let running = openingPkr;
  for (let i = 0; i < horizonDays; i++) {
    const day = isoDay(addDays(today, i));
    const b = buckets.get(day) ?? { inflow: 0, outflow: 0 };
    running += b.inflow - b.outflow;
    rows.push({ date: day, inflowPkr: b.inflow, outflowPkr: b.outflow, runningBalancePkr: running });
    if (running < 0) {
      warnings.push({ date: day, runningBalancePkr: running, floorPkr, reason: 'below_zero' });
    } else if (floorPkr > 0 && running < floorPkr) {
      warnings.push({ date: day, runningBalancePkr: running, floorPkr, reason: 'below_floor' });
    }
  }

  const generatedOn = isoDay(today);
  await db.insert(cashFlowForecasts).values({
    entityId,
    generatedOn,
    horizonDays: horizonDays.toString(),
    rows,
    cashGapWarnings: warnings,
  });

  return { entityId, generatedOn, horizonDays, openingPkr, rows, warnings };
}
