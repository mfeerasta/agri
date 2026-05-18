/**
 * Worker scoring + bonus computation.
 *
 * Composite score is deterministic, explainable, and auditable. Each
 * contribution is computed independently so the manager UI can render a
 * stacked-bar breakdown without re-deriving math.
 *
 * Formula (clamped to [0, 100]):
 *   attendanceRate           x 30
 *   min(tasksCompleted/20,1) x 25
 *   min(pieceRateUnits/500,1) x 25
 *   min(pieceRatePkr/50000,1) x 15
 *   tasksLate                x -2
 *   daysLate                 x -1
 *   dieselAnomaliesAssoc     x -5
 */

import { and, eq, gte, lte, desc, inArray } from 'drizzle-orm';
import {
  db,
  workers,
  attendanceRecords,
  tasks,
  taskCompletions,
  taskAssignments,
  pieceRateLogs,
  dieselAnomalies,
  dieselDailyLogs,
  workerScorePeriods,
  bonusRules,
} from '@zameen/db';

export interface WorkerScoreInput {
  workerId: string;
  entityId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface WorkerScore {
  workerId: string;
  workerName: string;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  tasksCompleted: number;
  tasksLate: number;
  pieceRateUnits: number;
  pieceRateTotalPkr: number;
  dieselAnomaliesAssociated: number;
  compositeScore: number;
  attendanceRate: number;
  taskCompletionRate: number;
  contributions: ScoreContributions;
}

export interface ScoreContributions {
  attendance: number;
  tasks: number;
  pieceRateVolume: number;
  pieceRateEarnings: number;
  taskLatePenalty: number;
  attendanceLatePenalty: number;
  dieselAnomalyPenalty: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInRange(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface AttendanceRow {
  status: string;
  checkInAt: Date | string | null;
}

function isLateCheckIn(checkIn: Date | string | null): boolean {
  if (!checkIn) return false;
  const d = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  const minutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return minutes > 7 * 60 + 30; // after 07:30 PKT counts as late
}

export async function computeWorkerScore(input: WorkerScoreInput): Promise<WorkerScore> {
  const startIso = isoDate(input.periodStart);
  const endIso = isoDate(input.periodEnd);

  const [worker] = await db.select().from(workers).where(eq(workers.id, input.workerId)).limit(1);
  if (!worker) throw new Error(`Worker ${input.workerId} not found`);

  const attendance = (await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, input.workerId),
        gte(attendanceRecords.workDate, startIso),
        lte(attendanceRecords.workDate, endIso),
      ),
    )) as unknown as AttendanceRow[];

  const present = attendance.filter((a) => a.status === 'present' || a.status === 'half_day');
  const daysPresent = present.reduce((acc, a) => acc + (a.status === 'half_day' ? 0.5 : 1), 0);
  const daysAbsent = attendance.filter((a) => a.status === 'absent').length;
  const daysLate = present.filter((a) => isLateCheckIn(a.checkInAt)).length;
  const totalDays = daysInRange(input.periodStart, input.periodEnd);
  const attendanceRate = clamp(daysPresent / totalDays, 0, 1);

  // Task completions in window
  const completions = await db
    .select()
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.workerId, input.workerId),
        gte(taskCompletions.completedAt, new Date(startIso)),
        lte(taskCompletions.completedAt, new Date(endIso + 'T23:59:59Z')),
      ),
    );
  const tasksCompleted = completions.length;

  // Tasks late: scheduled in window, assigned to worker, completed after due_date
  const assignments = await db
    .select()
    .from(taskAssignments)
    .where(eq(taskAssignments.workerId, input.workerId));
  const assignedTaskIds = assignments.map((a) => a.taskId as string);
  let tasksLate = 0;
  if (assignedTaskIds.length > 0) {
    const taskRows = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, assignedTaskIds));
    const completionByTask = new Map<string, Date>();
    for (const c of completions) {
      completionByTask.set(c.taskId as string, new Date(c.completedAt as unknown as string));
    }
    for (const t of taskRows) {
      const due = t.dueDate as string | null;
      if (!due) continue;
      const sched = t.scheduledFor as string | null;
      const anchor = sched ?? due;
      if (!(anchor >= startIso && anchor <= endIso)) continue;
      const done = completionByTask.get(t.id as string);
      const dueDate = new Date(due + 'T23:59:59Z');
      if (done && done.getTime() > dueDate.getTime()) tasksLate += 1;
      if (!done && t.status !== 'open' && new Date() > dueDate) tasksLate += 1;
    }
  }

  const totalAssigned = assignedTaskIds.length;
  const taskCompletionRate = totalAssigned > 0 ? clamp(tasksCompleted / totalAssigned, 0, 1) : 0;

  // Piece-rate totals
  const pieces = await db
    .select()
    .from(pieceRateLogs)
    .where(
      and(
        eq(pieceRateLogs.workerId, input.workerId),
        gte(pieceRateLogs.workDate, startIso),
        lte(pieceRateLogs.workDate, endIso),
      ),
    );
  const pieceRateUnits = pieces.reduce((s, p) => s + Number(p.quantity), 0);
  const pieceRateTotalPkr = pieces.reduce((s, p) => s + Number(p.totalPkr), 0);

  // Diesel anomalies tied to this operator via daily-log operator_id
  const operatorLogs = await db
    .select()
    .from(dieselDailyLogs)
    .where(
      and(
        eq(dieselDailyLogs.operatorId, input.workerId),
        gte(dieselDailyLogs.logDate, startIso),
        lte(dieselDailyLogs.logDate, endIso),
      ),
    );
  const logIds = operatorLogs.map((l) => l.id as string);
  let dieselAnomaliesAssociated = 0;
  if (logIds.length > 0) {
    const anomalies = await db
      .select()
      .from(dieselAnomalies)
      .where(inArray(dieselAnomalies.dieselDailyLogId, logIds));
    dieselAnomaliesAssociated = anomalies.length;
  }

  const contributions: ScoreContributions = {
    attendance: attendanceRate * 30,
    tasks: Math.min(tasksCompleted / 20, 1) * 25,
    pieceRateVolume: Math.min(pieceRateUnits / 500, 1) * 25,
    pieceRateEarnings: Math.min(pieceRateTotalPkr / 50000, 1) * 15,
    taskLatePenalty: -tasksLate * 2,
    attendanceLatePenalty: -daysLate * 1,
    dieselAnomalyPenalty: -dieselAnomaliesAssociated * 5,
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);
  const compositeScore = Number(clamp(raw, 0, 100).toFixed(4));

  return {
    workerId: input.workerId,
    workerName: (worker.fullName as string) ?? '',
    daysPresent,
    daysAbsent,
    daysLate,
    tasksCompleted,
    tasksLate,
    pieceRateUnits: Number(pieceRateUnits.toFixed(4)),
    pieceRateTotalPkr: Number(pieceRateTotalPkr.toFixed(2)),
    dieselAnomaliesAssociated,
    compositeScore,
    attendanceRate,
    taskCompletionRate,
    contributions,
  };
}

export async function computeAllWorkerScores({
  entityId,
  periodStart,
  periodEnd,
}: {
  entityId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<WorkerScore[]> {
  const roster = await db
    .select()
    .from(workers)
    .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)));

  const scores: WorkerScore[] = [];
  for (const w of roster) {
    const s = await computeWorkerScore({
      workerId: w.id as string,
      entityId,
      periodStart,
      periodEnd,
    });
    scores.push(s);
  }
  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  return scores;
}

/**
 * Persist a batch of computed scores into worker_score_periods, replacing
 * any existing rows for the same (worker, period). Computes rank.
 */
export async function persistScores({
  entityId,
  periodStart,
  periodEnd,
  scores,
}: {
  entityId: string;
  periodStart: Date;
  periodEnd: Date;
  scores: WorkerScore[];
}): Promise<void> {
  const startIso = isoDate(periodStart);
  const endIso = isoDate(periodEnd);
  const ranked = [...scores].sort((a, b) => b.compositeScore - a.compositeScore);

  // Drop existing rows for the period (idempotent re-run)
  await db
    .delete(workerScorePeriods)
    .where(
      and(
        eq(workerScorePeriods.entityId, entityId),
        eq(workerScorePeriods.periodStart, startIso),
        eq(workerScorePeriods.periodEnd, endIso),
      ),
    );

  for (let i = 0; i < ranked.length; i += 1) {
    const s = ranked[i]!;
    await db.insert(workerScorePeriods).values({
      entityId,
      workerId: s.workerId,
      periodStart: startIso,
      periodEnd: endIso,
      daysPresent: Math.round(s.daysPresent),
      daysAbsent: s.daysAbsent,
      daysLate: s.daysLate,
      tasksCompleted: s.tasksCompleted,
      tasksLate: s.tasksLate,
      pieceRateUnits: s.pieceRateUnits.toString(),
      pieceRateTotalPkr: s.pieceRateTotalPkr.toString(),
      dieselAnomaliesAssociated: s.dieselAnomaliesAssociated,
      compositeScore: s.compositeScore.toString(),
      rankInPeriod: i + 1,
      bonusEligible: false,
      bonusAmountPkr: '0',
    });
  }
}

export interface BonusComputeInput {
  ruleId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface BonusOutcome {
  workerId: string;
  bonusPkr: number;
}

export async function applyBonusRule(input: BonusComputeInput): Promise<BonusOutcome[]> {
  const [rule] = await db.select().from(bonusRules).where(eq(bonusRules.id, input.ruleId)).limit(1);
  if (!rule) throw new Error(`Bonus rule ${input.ruleId} not found`);
  if (!rule.active) return [];

  const startIso = isoDate(input.periodStart);
  const endIso = isoDate(input.periodEnd);

  const rows = await db
    .select()
    .from(workerScorePeriods)
    .where(
      and(
        eq(workerScorePeriods.entityId, rule.entityId as string),
        eq(workerScorePeriods.periodStart, startIso),
        eq(workerScorePeriods.periodEnd, endIso),
      ),
    )
    .orderBy(desc(workerScorePeriods.compositeScore));

  const formula = (rule.formula ?? {}) as {
    minDaysPresent?: number;
    maxDaysLate?: number;
    maxTasksLate?: number;
    maxDieselAnomalies?: number;
    minTasksCompleted?: number;
    minPieceRateUnits?: number;
  };
  const minScore = Number(rule.minScore);

  const eligible = rows.filter((r) => {
    if (Number(r.compositeScore) < minScore) return false;
    if (formula.minDaysPresent != null && (r.daysPresent as number) < formula.minDaysPresent) return false;
    if (formula.maxDaysLate != null && (r.daysLate as number) > formula.maxDaysLate) return false;
    if (formula.maxTasksLate != null && (r.tasksLate as number) > formula.maxTasksLate) return false;
    if (formula.maxDieselAnomalies != null && (r.dieselAnomaliesAssociated as number) > formula.maxDieselAnomalies) return false;
    if (formula.minTasksCompleted != null && (r.tasksCompleted as number) < formula.minTasksCompleted) return false;
    if (formula.minPieceRateUnits != null && Number(r.pieceRateUnits) < formula.minPieceRateUnits) return false;
    return true;
  });

  const winners = rule.amountKind === 'top_n' && rule.topN ? eligible.slice(0, rule.topN as number) : eligible;

  const outcomes: BonusOutcome[] = [];
  for (const row of winners) {
    let bonusPkr = 0;
    const amt = Number(rule.amountValue);
    if (rule.amountKind === 'flat' || rule.amountKind === 'top_n') {
      bonusPkr = amt;
    } else if (rule.amountKind === 'percent_of_base') {
      const [w] = await db.select().from(workers).where(eq(workers.id, row.workerId as string)).limit(1);
      const base = Number(w?.monthlySalaryPkr ?? w?.dailyWagePkr ?? 0);
      bonusPkr = Number((base * (amt / 100)).toFixed(2));
    } else if (rule.amountKind === 'percent_of_piece_rate') {
      bonusPkr = Number((Number(row.pieceRateTotalPkr) * (amt / 100)).toFixed(2));
    }

    await db
      .update(workerScorePeriods)
      .set({ bonusEligible: true, bonusAmountPkr: bonusPkr.toString() })
      .where(eq(workerScorePeriods.id, row.id as string));

    outcomes.push({ workerId: row.workerId as string, bonusPkr });
  }

  return outcomes;
}

/**
 * Compute the previous-calendar-month bounds in PKT.
 * Returns inclusive [start, end] dates.
 */
export function previousMonthBoundsPkt(reference: Date = new Date()): { start: Date; end: Date } {
  const pkt = new Date(reference.getTime() + 5 * 60 * 60 * 1000);
  const y = pkt.getUTCFullYear();
  const m = pkt.getUTCMonth(); // 0..11
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
}

