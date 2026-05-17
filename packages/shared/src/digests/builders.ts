/**
 * Digest builders: pull tables and pre-built finance functions to produce
 * structured payloads that channel-specific formatters (Slack, email,
 * WhatsApp) consume.
 *
 * Two shapes:
 *   - DailyDigest: yesterday-only ops snapshot for the daily Slack ping.
 *   - WeeklyDigest: rolled-up KPIs, anomalies, and decisions for the email.
 *
 * All amounts are PKR. No FX. Builders never throw on missing data — they
 * return zeros, empty arrays, and a benign weather summary so the digest
 * still ships.
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  db,
  entities,
  tasks,
  taskCompletions,
  attendanceRecords,
  workers,
  dieselDailyLogs,
  dieselAnomalies,
  repairRequests,
  approvalRequests,
  users,
  costAllocations,
  harvestRecords,
  cropPlans,
  cropProfiles,
  fields,
} from '@zameen/db';

export interface DailyDigest {
  date: string;
  entityId: string;
  entityName: string;
  yesterday: {
    tasksCompleted: number;
    tasksOpen: number;
    workersPresent: number;
    workersExpected: number;
    dieselConsumedLiters: number;
    dieselCostPkr: number;
    repairOpensCount: number;
    anomaliesFlagged: number;
  };
  today: {
    tasksScheduled: number;
    weatherSummary: string;
    irrigationDue: string[];
  };
  pendingApprovals: Array<{
    id: string;
    title: string;
    amountPkr: number | null;
    approverRole: string;
    ageHours: number;
  }>;
  notes: string;
}

export interface WeeklyDigest {
  weekStart: string;
  weekEnd: string;
  entityId: string;
  entityName: string;
  yieldKgByCrop: Record<string, number>;
  costsByCategoryPkr: Record<string, number>;
  topAnomalies: Array<{ kind: string; description: string; severity: string }>;
  decisionsBySender: Array<{ approverName: string; approvedCount: number; rejectedCount: number }>;
  upcomingDates: Array<{ when: string; what: string }>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 3_600_000));
}

export async function buildDailyDigest(entityId: string, asOf: Date): Promise<DailyDigest> {
  const today = isoDate(asOf);
  const yesterday = isoDate(addDays(asOf, -1));

  const [entity] = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);

  const entityName = entity?.name ?? 'Unknown entity';

  const tasksCompletedRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(taskCompletions)
    .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
    .where(
      and(
        eq(tasks.entityId, entityId),
        sql`${taskCompletions.completedAt}::date = ${yesterday}::date`,
      ),
    );
  const tasksCompleted = Number(tasksCompletedRows[0]?.c ?? 0);

  const tasksOpenRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(tasks)
    .where(and(eq(tasks.entityId, entityId), eq(tasks.status, 'open')));
  const tasksOpen = Number(tasksOpenRows[0]?.c ?? 0);

  const tasksScheduledRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(tasks)
    .where(and(eq(tasks.entityId, entityId), eq(tasks.scheduledFor, today)));
  const tasksScheduled = Number(tasksScheduledRows[0]?.c ?? 0);

  const presentRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.entityId, entityId),
        eq(attendanceRecords.workDate, yesterday),
        eq(attendanceRecords.status, 'present'),
      ),
    );
  const workersPresent = Number(presentRows[0]?.c ?? 0);

  const expectedRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(workers)
    .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)));
  const workersExpected = Number(expectedRows[0]?.c ?? 0);

  const dieselRows = await db
    .select({
      liters: sql<string>`coalesce(sum(${dieselDailyLogs.dieselFilledLiters}), 0)::text`,
      cost: sql<string>`coalesce(sum(${dieselDailyLogs.totalCostPkr}), 0)::text`,
    })
    .from(dieselDailyLogs)
    .where(and(eq(dieselDailyLogs.entityId, entityId), eq(dieselDailyLogs.logDate, yesterday)));
  const dieselConsumedLiters = Number(dieselRows[0]?.liters ?? 0);
  const dieselCostPkr = Number(dieselRows[0]?.cost ?? 0);

  const repairRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(repairRequests)
    .where(
      and(
        eq(repairRequests.entityId, entityId),
        sql`${repairRequests.createdAt}::date = ${yesterday}::date`,
      ),
    );
  const repairOpensCount = Number(repairRows[0]?.c ?? 0);

  const anomalyRows = await db
    .select({ c: sql<string>`count(*)::text` })
    .from(dieselAnomalies)
    .where(
      and(
        eq(dieselAnomalies.entityId, entityId),
        eq(dieselAnomalies.detectedOn, yesterday),
      ),
    );
  const anomaliesFlagged = Number(anomalyRows[0]?.c ?? 0);

  const pendingRows = await db
    .select({
      id: approvalRequests.id,
      title: approvalRequests.title,
      amountPkr: approvalRequests.amountPkr,
      state: approvalRequests.state,
      submittedAt: approvalRequests.submittedAt,
      createdAt: approvalRequests.createdAt,
      approverId: approvalRequests.currentApproverId,
    })
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityId, entityId),
        sql`${approvalRequests.state} in ('submitted','pending_supervisor','pending_farm_manager','pending_director','escalated')`,
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(20);

  const approverIds = pendingRows
    .map((r) => r.approverId)
    .filter((id): id is string => Boolean(id));
  const approverMap = new Map<string, { fullName: string; role: string }>();
  if (approverIds.length > 0) {
    const aRows = await db
      .select({ id: users.id, fullName: users.fullName, role: users.primaryRole })
      .from(users)
      .where(sql`${users.id} = any(${approverIds}::uuid[])`);
    for (const a of aRows) {
      approverMap.set(a.id, { fullName: a.fullName, role: a.role });
    }
  }

  const pendingApprovals = pendingRows.map((row) => {
    const base = row.submittedAt ?? row.createdAt ?? asOf;
    return {
      id: row.id,
      title: row.title,
      amountPkr: row.amountPkr == null ? null : Number(row.amountPkr),
      approverRole: row.approverId ? approverMap.get(row.approverId)?.role ?? 'pending' : 'unassigned',
      ageHours: hoursBetween(new Date(base as unknown as string), asOf),
    };
  });

  return {
    date: today,
    entityId,
    entityName,
    yesterday: {
      tasksCompleted,
      tasksOpen,
      workersPresent,
      workersExpected,
      dieselConsumedLiters,
      dieselCostPkr,
      repairOpensCount,
      anomaliesFlagged,
    },
    today: {
      tasksScheduled,
      weatherSummary: 'Weather feed pending.',
      irrigationDue: [],
    },
    pendingApprovals,
    notes:
      pendingApprovals.length > 3
        ? `${pendingApprovals.length} approvals pending. Several over 24h old.`
        : '',
  };
}

export async function buildWeeklyDigest(entityId: string, weekStart: Date): Promise<WeeklyDigest> {
  const start = isoDate(weekStart);
  const end = isoDate(addDays(weekStart, 6));

  const [entity] = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  const entityName = entity?.name ?? 'Unknown entity';

  const yieldRows = await db
    .select({
      cropName: cropProfiles.name,
      totalKg: sql<string>`coalesce(sum(${harvestRecords.netWeightKg}), 0)::text`,
    })
    .from(harvestRecords)
    .innerJoin(cropPlans, eq(cropPlans.id, harvestRecords.cropPlanId))
    .innerJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(
      and(
        eq(cropPlans.entityId, entityId),
        gte(harvestRecords.harvestDate, start),
        lte(harvestRecords.harvestDate, end),
      ),
    )
    .groupBy(cropProfiles.name);

  const yieldKgByCrop: Record<string, number> = {};
  for (const row of yieldRows) {
    yieldKgByCrop[row.cropName] = Number(row.totalKg);
  }

  const costRows = await db
    .select({
      pool: costAllocations.costPool,
      total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)::text`,
    })
    .from(costAllocations)
    .where(
      and(
        eq(costAllocations.entityId, entityId),
        gte(costAllocations.allocatedOn, start),
        lte(costAllocations.allocatedOn, end),
      ),
    )
    .groupBy(costAllocations.costPool);

  const costsByCategoryPkr: Record<string, number> = {};
  for (const row of costRows) {
    costsByCategoryPkr[row.pool] = Number(row.total);
  }

  const anomaliesRows = await db
    .select({
      severity: dieselAnomalies.severity,
      deviationPct: dieselAnomalies.deviationPct,
      detectedOn: dieselAnomalies.detectedOn,
    })
    .from(dieselAnomalies)
    .where(
      and(
        eq(dieselAnomalies.entityId, entityId),
        gte(dieselAnomalies.detectedOn, start),
        lte(dieselAnomalies.detectedOn, end),
      ),
    )
    .orderBy(desc(dieselAnomalies.deviationPct))
    .limit(5);

  const topAnomalies = anomaliesRows.map((row) => ({
    kind: 'diesel_burn',
    description: `Burn ${row.deviationPct}% above rolling avg on ${row.detectedOn}`,
    severity: row.severity,
  }));

  const decisionsRows = await db
    .select({
      approverId: approvalRequests.currentApproverId,
      state: approvalRequests.state,
    })
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityId, entityId),
        sql`${approvalRequests.decidedAt} >= ${start}::timestamptz`,
        sql`${approvalRequests.decidedAt} <= (${end}::date + interval '1 day')`,
      ),
    );

  const decisionMap = new Map<string, { approved: number; rejected: number }>();
  for (const row of decisionsRows) {
    if (!row.approverId) continue;
    const slot = decisionMap.get(row.approverId) ?? { approved: 0, rejected: 0 };
    if (row.state === 'approved') slot.approved += 1;
    if (row.state === 'rejected') slot.rejected += 1;
    decisionMap.set(row.approverId, slot);
  }

  const approverIds = Array.from(decisionMap.keys());
  const decisionsBySender: Array<{ approverName: string; approvedCount: number; rejectedCount: number }> = [];
  if (approverIds.length > 0) {
    const nameRows = await db
      .select({ id: users.id, name: users.fullName })
      .from(users)
      .where(sql`${users.id} = any(${approverIds}::uuid[])`);
    const nameMap = new Map(nameRows.map((r) => [r.id, r.name]));
    for (const [approverId, totals] of decisionMap) {
      decisionsBySender.push({
        approverName: nameMap.get(approverId) ?? 'Unknown',
        approvedCount: totals.approved,
        rejectedCount: totals.rejected,
      });
    }
  }

  const nextWeekEnd = isoDate(addDays(weekStart, 13));
  const upcomingTasks = await db
    .select({ scheduledFor: tasks.scheduledFor, title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.entityId, entityId),
        gte(tasks.scheduledFor, end),
        lte(tasks.scheduledFor, nextWeekEnd),
      ),
    )
    .orderBy(tasks.scheduledFor)
    .limit(10);

  const upcomingDates = upcomingTasks
    .filter((t) => t.scheduledFor != null)
    .map((t) => ({ when: t.scheduledFor as string, what: t.title }));

  return {
    weekStart: start,
    weekEnd: end,
    entityId,
    entityName,
    yieldKgByCrop,
    costsByCategoryPkr,
    topAnomalies,
    decisionsBySender,
    upcomingDates,
  };
}
