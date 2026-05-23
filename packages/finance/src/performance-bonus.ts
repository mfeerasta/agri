/**
 * Performance bonus engine. Pulls attendance, harvest credit, breakdown
 * counts and on-time task completion for a worker over a period and
 * applies a rule-set to compute the bonus breakdown.
 */

import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import {
  db,
  workers,
  attendanceRecords,
  tasks,
  taskAssignments,
  taskCompletions,
  harvestRecords,
  cropPlans,
  repairRequests,
  dieselDailyLogs,
} from '@zameen/db';

export interface PerformanceBonusRules {
  attendanceBonusPctOver90?: number;
  harvestBonusPerKg?: number;
  noBreakdownBonusPkr?: number;
  taskCompletionBonusPctOnTime?: number;
}

export interface BonusBreakdown {
  attendanceBonusPkr: number;
  harvestBonusPkr: number;
  noBreakdownBonusPkr: number;
  taskCompletionBonusPkr: number;
  attendancePct: number;
  harvestKg: number;
  breakdownEvents: number;
  taskOnTimePct: number;
}

export interface ComputeBonusInput {
  entityId: string;
  workerId: string;
  fromDate: string;
  toDate: string;
  rules: PerformanceBonusRules;
}

export interface ComputeBonusResult {
  workerId: string;
  baseSalary: number;
  bonusBreakdown: BonusBreakdown;
  totalBonus: number;
  totalPay: number;
}

function daysBetweenIso(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

export async function computeBonusForPeriod(
  input: ComputeBonusInput,
): Promise<ComputeBonusResult> {
  const { entityId, workerId, fromDate, toDate, rules } = input;

  const [worker] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
  if (!worker) throw new Error(`Worker ${workerId} not found`);
  if (worker.entityId !== entityId) {
    throw new Error(`Worker ${workerId} does not belong to entity ${entityId}`);
  }

  const baseSalary = Number(worker.monthlySalaryPkr ?? worker.dailyWagePkr ?? 0);
  const totalDays = daysBetweenIso(fromDate, toDate);

  // Attendance %
  const attendance = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, workerId),
        gte(attendanceRecords.workDate, fromDate),
        lte(attendanceRecords.workDate, toDate),
      ),
    );
  const daysPresent = attendance.reduce(
    (acc, a) =>
      acc + (a.status === 'present' ? 1 : a.status === 'half_day' ? 0.5 : 0),
    0,
  );
  const attendancePct = totalDays > 0 ? (daysPresent / totalDays) * 100 : 0;

  // Harvest credited to worker: assignments → tasks.fieldId → harvestRecords via cropPlans.fieldId
  const assignments = await db
    .select({ taskId: taskAssignments.taskId })
    .from(taskAssignments)
    .where(eq(taskAssignments.workerId, workerId));
  const assignedTaskIds = assignments.map((a) => a.taskId);

  let harvestKg = 0;
  if (assignedTaskIds.length > 0) {
    const taskRows = await db
      .select({ id: tasks.id, fieldId: tasks.fieldId })
      .from(tasks)
      .where(inArray(tasks.id, assignedTaskIds));
    const fieldIds = Array.from(
      new Set(taskRows.map((t) => t.fieldId).filter((id): id is string => Boolean(id))),
    );
    if (fieldIds.length > 0) {
      const plans = await db
        .select({ id: cropPlans.id, fieldId: cropPlans.fieldId })
        .from(cropPlans)
        .where(inArray(cropPlans.fieldId, fieldIds));
      const planIds = plans.map((p) => p.id);
      if (planIds.length > 0) {
        const harvests = await db
          .select()
          .from(harvestRecords)
          .where(inArray(harvestRecords.cropPlanId, planIds));
        const fromTs = new Date(`${fromDate}T00:00:00Z`).getTime();
        const toTs = new Date(`${toDate}T23:59:59Z`).getTime();
        for (const h of harvests) {
          const ts = new Date(h.harvestedOn as unknown as string).getTime();
          if (ts >= fromTs && ts <= toTs) {
            harvestKg += Number(h.grossYieldKg);
          }
        }
      }
    }
  }

  // Breakdown-causing events: diesel daily logs operated by this worker → repair requests
  // on those same assets reported in window with severity major/breakdown.
  const operatorLogs = await db
    .select({ assetId: dieselDailyLogs.assetId })
    .from(dieselDailyLogs)
    .where(
      and(
        eq(dieselDailyLogs.operatorId, workerId),
        gte(dieselDailyLogs.logDate, fromDate),
        lte(dieselDailyLogs.logDate, toDate),
      ),
    );
  const operatedAssetIds = Array.from(
    new Set(operatorLogs.map((l) => l.assetId).filter((id): id is string => Boolean(id))),
  );
  let breakdownEvents = 0;
  if (operatedAssetIds.length > 0) {
    const fromTs = new Date(`${fromDate}T00:00:00Z`);
    const toTs = new Date(`${toDate}T23:59:59Z`);
    const repairs = await db
      .select()
      .from(repairRequests)
      .where(
        and(
          inArray(repairRequests.assetId, operatedAssetIds),
          gte(repairRequests.reportedAt, fromTs),
          lte(repairRequests.reportedAt, toTs),
        ),
      );
    breakdownEvents = repairs.filter(
      (r) => r.severity === 'major' || r.severity === 'breakdown',
    ).length;
  }

  // On-time task completion %
  let taskOnTimePct = 0;
  if (assignedTaskIds.length > 0) {
    const taskRows = await db
      .select({ id: tasks.id, dueDate: tasks.dueDate, scheduledFor: tasks.scheduledFor })
      .from(tasks)
      .where(inArray(tasks.id, assignedTaskIds));
    const completions = await db
      .select()
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.workerId, workerId),
          gte(taskCompletions.completedAt, new Date(`${fromDate}T00:00:00Z`)),
          lte(taskCompletions.completedAt, new Date(`${toDate}T23:59:59Z`)),
        ),
      );
    const completionByTask = new Map<string, Date>();
    for (const c of completions) {
      completionByTask.set(c.taskId, new Date(c.completedAt as unknown as string));
    }
    const inWindow = taskRows.filter((t) => {
      const anchor = (t.scheduledFor ?? t.dueDate) as string | null;
      return anchor && anchor >= fromDate && anchor <= toDate;
    });
    let onTime = 0;
    let counted = 0;
    for (const t of inWindow) {
      const due = t.dueDate as string | null;
      if (!due) continue;
      counted += 1;
      const done = completionByTask.get(t.id);
      if (done && done.getTime() <= new Date(`${due}T23:59:59Z`).getTime()) {
        onTime += 1;
      }
    }
    taskOnTimePct = counted > 0 ? (onTime / counted) * 100 : 0;
  }

  // Apply rules
  const attendanceBonusPct = rules.attendanceBonusPctOver90 ?? 0;
  const attendanceBonusPkr =
    attendancePct > 90 && attendanceBonusPct > 0 && baseSalary > 0
      ? +((baseSalary * attendanceBonusPct) / 100).toFixed(2)
      : 0;

  const harvestPerKg = rules.harvestBonusPerKg ?? 0;
  const harvestBonusPkr = harvestPerKg > 0 ? +(harvestKg * harvestPerKg).toFixed(2) : 0;

  const noBreakdownPkr = rules.noBreakdownBonusPkr ?? 0;
  const noBreakdownBonusPkr =
    breakdownEvents === 0 && operatedAssetIds.length > 0 && noBreakdownPkr > 0
      ? noBreakdownPkr
      : 0;

  const taskCompletionPct = rules.taskCompletionBonusPctOnTime ?? 0;
  const taskCompletionBonusPkr =
    taskOnTimePct >= 100 && taskCompletionPct > 0 && baseSalary > 0
      ? +((baseSalary * taskCompletionPct) / 100).toFixed(2)
      : 0;

  const bonusBreakdown: BonusBreakdown = {
    attendanceBonusPkr,
    harvestBonusPkr,
    noBreakdownBonusPkr,
    taskCompletionBonusPkr,
    attendancePct: +attendancePct.toFixed(2),
    harvestKg: +harvestKg.toFixed(2),
    breakdownEvents,
    taskOnTimePct: +taskOnTimePct.toFixed(2),
  };

  const totalBonus = +(
    attendanceBonusPkr +
    harvestBonusPkr +
    noBreakdownBonusPkr +
    taskCompletionBonusPkr
  ).toFixed(2);

  return {
    workerId,
    baseSalary: +baseSalary.toFixed(2),
    bonusBreakdown,
    totalBonus,
    totalPay: +(baseSalary + totalBonus).toFixed(2),
  };
}
