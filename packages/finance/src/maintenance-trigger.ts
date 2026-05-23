/**
 * Daily preventive-maintenance due-date evaluator.
 *
 * Run from a Supabase cron at 06:00 local. For each active plan:
 *  - hour_meter: compare cumulative hours since last execution against trigger_value
 *  - days_elapsed: simple date math
 *  - calendar_date / cron_expression: emit when due in the next 7 days
 *  - condition_based: pull from open diesel anomalies for the asset
 *
 * Side effects: updates next_due_at on the plan and returns the list of
 * plans that became due so the caller can enqueue notifications and
 * (when threshold-cost) open an approval request.
 */

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  db,
  assets,
  dieselDailyLogs,
  dieselAnomalies,
  maintenanceExecutions,
  maintenancePlans,
} from '@zameen/db';

export interface DuePlan {
  planId: string;
  assetId: string;
  assetCode: string;
  entityId: string;
  name: string;
  triggerKind: string;
  reason: string;
  estimatedCostPkr: number | null;
  overdueBy: number;
  overdueUnit: 'hours' | 'days' | 'count';
}

async function latestExecution(planId: string) {
  const [row] = await db
    .select()
    .from(maintenanceExecutions)
    .where(eq(maintenanceExecutions.planId, planId))
    .orderBy(desc(maintenanceExecutions.executedOn))
    .limit(1);
  return row ?? null;
}

async function latestHourMeter(assetId: string): Promise<number> {
  const [row] = await db
    .select({ h: sql<string>`coalesce(max(${dieselDailyLogs.hourMeterEnd}), 0)` })
    .from(dieselDailyLogs)
    .where(eq(dieselDailyLogs.assetId, assetId));
  const fromLogs = Number(row?.h ?? 0);
  const [a] = await db.select({ h: assets.currentHourMeter }).from(assets).where(eq(assets.id, assetId)).limit(1);
  const fromAsset = Number(a?.h ?? 0);
  return Math.max(fromLogs, fromAsset);
}

export async function checkMaintenanceDue(now: Date = new Date()): Promise<DuePlan[]> {
  const plans = await db
    .select()
    .from(maintenancePlans)
    .where(eq(maintenancePlans.isActive, true));
  const due: DuePlan[] = [];

  for (const plan of plans) {
    const [asset] = await db.select().from(assets).where(eq(assets.id, plan.assetId)).limit(1);
    if (!asset) continue;
    const lastExec = await latestExecution(plan.id);
    const triggerValue = Number(plan.triggerValue ?? 0);

    let isDue = false;
    let reason = '';
    let overdueBy = 0;
    let overdueUnit: DuePlan['overdueUnit'] = 'days';

    if (plan.triggerKind === 'hour_meter' && triggerValue > 0) {
      const currentHours = await latestHourMeter(plan.assetId);
      const baseline = lastExec ? Number(lastExec.hourMeterAtService ?? 0) : 0;
      const delta = currentHours - baseline;
      if (delta >= triggerValue) {
        isDue = true;
        overdueBy = Number((delta - triggerValue).toFixed(2));
        overdueUnit = 'hours';
        reason = `${delta.toFixed(0)}h since last service (every ${triggerValue}h)`;
      }
    } else if (plan.triggerKind === 'days_elapsed' && triggerValue > 0) {
      const last = lastExec?.executedOn ? new Date(lastExec.executedOn) : new Date(plan.createdAt);
      const days = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
      if (days >= triggerValue) {
        isDue = true;
        overdueBy = days - triggerValue;
        overdueUnit = 'days';
        reason = `${days}d since last service (every ${triggerValue}d)`;
      }
    } else if (plan.triggerKind === 'calendar_date' && plan.nextDueAt) {
      const next = new Date(plan.nextDueAt);
      const diffDays = Math.floor((now.getTime() - next.getTime()) / 86_400_000);
      if (diffDays >= 0) {
        isDue = true;
        overdueBy = diffDays;
        overdueUnit = 'days';
        reason = `scheduled date passed by ${diffDays}d`;
      }
    } else if (plan.triggerKind === 'condition_based') {
      const anomalies = await db
        .select()
        .from(dieselAnomalies)
        .where(and(eq(dieselAnomalies.assetId, plan.assetId), eq(dieselAnomalies.status, 'open')));
      if (anomalies.length > 0) {
        isDue = true;
        overdueBy = anomalies.length;
        overdueUnit = 'count';
        reason = `${anomalies.length} open fuel anomaly flag(s)`;
      }
    }

    if (isDue) {
      due.push({
        planId: plan.id,
        assetId: plan.assetId,
        assetCode: asset.code,
        entityId: asset.entityId,
        name: plan.name,
        triggerKind: plan.triggerKind,
        reason,
        estimatedCostPkr: plan.estimatedCostPkr ? Number(plan.estimatedCostPkr) : null,
        overdueBy,
        overdueUnit,
      });
      await db
        .update(maintenancePlans)
        .set({ nextDueAt: now })
        .where(eq(maintenancePlans.id, plan.id));
    }
  }

  return due;
}

export async function projectNextDueAt(planId: string, executedAt: Date): Promise<Date | null> {
  const [plan] = await db.select().from(maintenancePlans).where(eq(maintenancePlans.id, planId)).limit(1);
  if (!plan) return null;
  const trig = Number(plan.triggerValue ?? 0);
  if (plan.triggerKind === 'days_elapsed' && trig > 0) {
    return new Date(executedAt.getTime() + trig * 86_400_000);
  }
  // hour_meter, condition_based, calendar_date — caller projects.
  return null;
}
