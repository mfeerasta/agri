'use server';
import { and, between, eq, inArray, isNotNull } from 'drizzle-orm';
import {
  db,
  workers,
  attendanceRecords,
  taskTimeEntries,
  tasks,
  fields,
  blocks,
  farms,
} from '@zameen/db';

export interface LabourCostLogCell {
  hours: number;
  totalPkr: number;
  workerCount: number;
}

export interface LabourCostLogRow {
  date: string;
  perField: Record<string, LabourCostLogCell>;
  totalPkr: number;
  totalHours: number;
}

export interface LabourCostLogFieldTotal {
  totalPkr: number;
  totalHours: number;
  perAcrePkr: number;
}

export interface LabourProductivityPoint {
  date: string;
  pkrPerAcre: number;
  isOutlier: boolean;
}

export interface LabourProductivitySeries {
  fieldId: string;
  fieldCode: string;
  acres: number;
  points: LabourProductivityPoint[];
  meanPkrPerAcre: number;
  stdDevPkrPerAcre: number;
}

export interface LabourCostLogData {
  fromDate: string;
  toDate: string;
  fields: Array<{ id: string; code: string; name: string | null; acres: number }>;
  rows: LabourCostLogRow[];
  fieldTotals: Record<string, LabourCostLogFieldTotal>;
  grandTotalPkr: number;
  grandTotalHours: number;
  productivity: LabourProductivitySeries[];
}

interface WorkerRateRow {
  id: string;
  workerType: string;
  monthlySalaryPkr: string | null;
  dailyWagePkr: string | null;
}

function hourlyRatePkr(w: WorkerRateRow): number {
  if (w.workerType === 'permanent' && w.monthlySalaryPkr) {
    return Number(w.monthlySalaryPkr) / (26 * 8);
  }
  if (w.dailyWagePkr) {
    return Number(w.dailyWagePkr) / 8;
  }
  if (w.monthlySalaryPkr) {
    return Number(w.monthlySalaryPkr) / (26 * 8);
  }
  return 0;
}

function isoDate(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

function hoursBetween(start: Date | string | null, end: Date | string | null): number {
  if (!start || !end) return 0;
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  const ms = e.getTime() - s.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

export async function loadLabourCostLog({
  entityId,
  fromDate,
  toDate,
}: {
  entityId: string;
  fromDate: string;
  toDate: string;
}): Promise<LabourCostLogData> {
  const farmRows = await db
    .select({ id: farms.id })
    .from(farms)
    .where(eq(farms.entityId, entityId));
  const farmIds = farmRows.map((r) => r.id);

  const blockRows = farmIds.length
    ? await db.select({ id: blocks.id }).from(blocks).where(inArray(blocks.farmId, farmIds))
    : [];
  const blockIds = blockRows.map((r) => r.id);

  const fieldRows = blockIds.length
    ? await db
        .select({ id: fields.id, code: fields.code, name: fields.name, acres: fields.acres })
        .from(fields)
        .where(inArray(fields.blockId, blockIds))
    : [];
  const fieldIds = new Set(fieldRows.map((f) => f.id));

  const workerRows = await db
    .select({
      id: workers.id,
      workerType: workers.workerType,
      monthlySalaryPkr: workers.monthlySalaryPkr,
      dailyWagePkr: workers.dailyWagePkr,
    })
    .from(workers)
    .where(eq(workers.entityId, entityId));
  const rateByWorker = new Map<string, number>();
  for (const w of workerRows) {
    rateByWorker.set(w.id, hourlyRatePkr(w));
  }

  const fromTs = new Date(`${fromDate}T00:00:00Z`);
  const toTs = new Date(`${toDate}T23:59:59Z`);

  const attRows = await db
    .select({
      workerId: attendanceRecords.workerId,
      workDate: attendanceRecords.workDate,
      checkInAt: attendanceRecords.checkInAt,
      checkOutAt: attendanceRecords.checkOutAt,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.entityId, entityId),
        between(attendanceRecords.workDate, fromDate, toDate),
      ),
    );

  const dailyAttHours = new Map<string, number>();
  for (const a of attRows) {
    if (a.status === 'absent') continue;
    let h = hoursBetween(a.checkInAt, a.checkOutAt);
    if (h === 0) {
      h = a.status === 'half_day' ? 4 : 8;
    }
    const d = isoDate(a.workDate);
    const key = `${a.workerId}|${d}`;
    dailyAttHours.set(key, (dailyAttHours.get(key) ?? 0) + h);
  }

  const tteRows = fieldIds.size
    ? await db
        .select({
          workerId: taskTimeEntries.workerId,
          startedAt: taskTimeEntries.startedAt,
          endedAt: taskTimeEntries.endedAt,
          durationMinutes: taskTimeEntries.durationMinutes,
          fieldId: tasks.fieldId,
        })
        .from(taskTimeEntries)
        .innerJoin(tasks, eq(taskTimeEntries.taskId, tasks.id))
        .where(
          and(
            isNotNull(tasks.fieldId),
            between(taskTimeEntries.startedAt, fromTs, toTs),
          ),
        )
    : [];

  type DailyKey = string;
  interface PerFieldAgg {
    hours: number;
    totalPkr: number;
    workers: Set<string>;
  }
  const byDateField = new Map<DailyKey, Map<string, PerFieldAgg>>();
  const dateSet = new Set<string>();

  const dailyWorkerByField = new Map<string, Map<string, number>>();
  for (const t of tteRows) {
    if (!t.fieldId || !fieldIds.has(t.fieldId)) continue;
    const d = isoDate(t.startedAt);
    const h =
      typeof t.durationMinutes === 'number' && t.durationMinutes > 0
        ? t.durationMinutes / 60
        : hoursBetween(t.startedAt, t.endedAt);
    if (h <= 0) continue;
    const key = `${t.workerId}|${d}`;
    let m = dailyWorkerByField.get(key);
    if (!m) {
      m = new Map<string, number>();
      dailyWorkerByField.set(key, m);
    }
    m.set(t.fieldId, (m.get(t.fieldId) ?? 0) + h);
  }

  for (const [key, fieldMap] of dailyWorkerByField) {
    const [workerId, d] = key.split('|');
    const rate = rateByWorker.get(workerId) ?? 0;
    const tteTotal = Array.from(fieldMap.values()).reduce((s, v) => s + v, 0);
    const attTotal = dailyAttHours.get(key);
    const billableHours = attTotal && attTotal > 0 ? attTotal : tteTotal;
    if (tteTotal <= 0) continue;

    dateSet.add(d);
    let dateMap = byDateField.get(d);
    if (!dateMap) {
      dateMap = new Map<string, PerFieldAgg>();
      byDateField.set(d, dateMap);
    }
    for (const [fieldId, fhours] of fieldMap) {
      const share = fhours / tteTotal;
      const allocatedHours = billableHours * share;
      const cost = allocatedHours * rate;
      let agg = dateMap.get(fieldId);
      if (!agg) {
        agg = { hours: 0, totalPkr: 0, workers: new Set<string>() };
        dateMap.set(fieldId, agg);
      }
      agg.hours += allocatedHours;
      agg.totalPkr += cost;
      agg.workers.add(workerId);
    }
  }

  const rows: LabourCostLogRow[] = [];
  const fieldTotals: Record<string, LabourCostLogFieldTotal> = {};
  let grandTotalPkr = 0;
  let grandTotalHours = 0;

  const sortedDates = Array.from(dateSet).sort((a, b) => (a < b ? 1 : -1));
  for (const d of sortedDates) {
    const dateMap = byDateField.get(d);
    if (!dateMap) continue;
    const perField: Record<string, LabourCostLogCell> = {};
    let dayPkr = 0;
    let dayHours = 0;
    for (const [fieldId, agg] of dateMap) {
      const cell: LabourCostLogCell = {
        hours: +agg.hours.toFixed(2),
        totalPkr: +agg.totalPkr.toFixed(2),
        workerCount: agg.workers.size,
      };
      perField[fieldId] = cell;
      dayPkr += cell.totalPkr;
      dayHours += cell.hours;
      const ft = fieldTotals[fieldId] ?? { totalPkr: 0, totalHours: 0, perAcrePkr: 0 };
      ft.totalPkr += cell.totalPkr;
      ft.totalHours += cell.hours;
      fieldTotals[fieldId] = ft;
    }
    rows.push({ date: d, perField, totalPkr: +dayPkr.toFixed(2), totalHours: +dayHours.toFixed(2) });
    grandTotalPkr += dayPkr;
    grandTotalHours += dayHours;
  }

  const fieldsList = fieldRows.map((f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    acres: Number(f.acres),
  }));

  for (const f of fieldsList) {
    const ft = fieldTotals[f.id];
    if (ft) {
      ft.perAcrePkr = f.acres > 0 ? +(ft.totalPkr / f.acres).toFixed(2) : 0;
      ft.totalPkr = +ft.totalPkr.toFixed(2);
      ft.totalHours = +ft.totalHours.toFixed(2);
    }
  }

  const productivity: LabourProductivitySeries[] = fieldsList.map((f) => {
    const points: LabourProductivityPoint[] = [];
    for (const r of rows) {
      const cell = r.perField[f.id];
      if (!cell) continue;
      const pkrPerAcre = f.acres > 0 ? cell.totalPkr / f.acres : 0;
      points.push({ date: r.date, pkrPerAcre: +pkrPerAcre.toFixed(2), isOutlier: false });
    }
    const n = points.length;
    const mean = n > 0 ? points.reduce((s, p) => s + p.pkrPerAcre, 0) / n : 0;
    const variance =
      n > 1 ? points.reduce((s, p) => s + (p.pkrPerAcre - mean) ** 2, 0) / (n - 1) : 0;
    const std = Math.sqrt(variance);
    for (const p of points) {
      if (std > 0 && Math.abs(p.pkrPerAcre - mean) > 2 * std) p.isOutlier = true;
    }
    return {
      fieldId: f.id,
      fieldCode: f.code,
      acres: f.acres,
      points: points.sort((a, b) => (a.date < b.date ? -1 : 1)),
      meanPkrPerAcre: +mean.toFixed(2),
      stdDevPkrPerAcre: +std.toFixed(2),
    };
  });

  return {
    fromDate,
    toDate,
    fields: fieldsList,
    rows,
    fieldTotals,
    grandTotalPkr: +grandTotalPkr.toFixed(2),
    grandTotalHours: +grandTotalHours.toFixed(2),
    productivity,
  };
}
