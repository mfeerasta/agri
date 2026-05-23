/**
 * Per-entity payroll divisor and net-pay calculator (Haazri parity model).
 *
 * Different entities pay on different calendar conventions: AGRI uses a flat
 * 30-day month, RFB uses actual calendar days, ZP uses a 26 working-day
 * month. The divisor decides how attendance days convert to base pay; net
 * pay layers piece rates, advances, and deductions on top.
 */

import { and, eq, gte, lte } from 'drizzle-orm';
import {
  db,
  entities,
  entitySettings,
  holidays,
  workers,
  attendanceRecords,
  pieceRateLogs,
} from '@zameen/db';

export interface HolidayPolicy {
  countPublicHolidaysAsWorked: boolean;
  countReligiousHolidaysAsWorked: boolean;
}

const DEFAULT_HOLIDAY_POLICY: HolidayPolicy = {
  countPublicHolidaysAsWorked: true,
  countReligiousHolidaysAsWorked: true,
};

export async function resolveHolidayPolicy(entityId: string): Promise<HolidayPolicy> {
  const [s] = await db
    .select()
    .from(entitySettings)
    .where(eq(entitySettings.entityId, entityId))
    .limit(1);
  const cfg = (s?.unitsConfig ?? {}) as { holidayPolicy?: Partial<HolidayPolicy> };
  return { ...DEFAULT_HOLIDAY_POLICY, ...(cfg.holidayPolicy ?? {}) };
}

export async function countDeductibleHolidays(
  periodStart: string,
  periodEnd: string,
  policy: HolidayPolicy,
): Promise<number> {
  const rows = await db
    .select()
    .from(holidays)
    .where(and(gte(holidays.date, periodStart), lte(holidays.date, periodEnd)));
  let deduct = 0;
  for (const r of rows) {
    if (r.kind === 'public' && !policy.countPublicHolidaysAsWorked) deduct++;
    else if (r.kind === 'religious' && !policy.countReligiousHolidaysAsWorked) deduct++;
  }
  return deduct;
}

export type PayrollDivisorKind = 'flat_30' | 'actual_calendar' | 'flat_26';

export interface PayrollDivisor {
  entityCode: string;
  kind: PayrollDivisorKind;
  divisorForPeriod: (periodStart: string, periodEnd: string) => number;
}

function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso);
  const b = new Date(endIso);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/**
 * Resolve the payroll divisor for a given entity by its short code.
 * Defaults to a 30-day flat month if the entity code is unknown.
 */
export async function payrollDivisorFor(entityId: string): Promise<PayrollDivisor> {
  const [e] = await db.select().from(entities).where(eq(entities.id, entityId)).limit(1);
  const code = e?.code ?? '';
  const policy = await resolveHolidayPolicy(entityId);
  if (code === 'RFB') {
    return {
      entityCode: code,
      kind: 'actual_calendar',
      divisorForPeriod: (s, en) => daysBetween(s, en),
    };
  }
  if (code === 'ZP') {
    return { entityCode: code, kind: 'flat_26', divisorForPeriod: () => 26 };
  }
  // AGRI default: flat-30 less any holidays the entity policy says don't count
  // as worked. Async deduction can't return through the divisor signature, so
  // we keep this synchronous but expose policy to callers via resolveHolidayPolicy.
  void policy;
  return { entityCode: code || 'AGRI', kind: 'flat_30', divisorForPeriod: () => 30 };
}

export interface NetPayInput {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  advancesPkr?: number;
  deductionsPkr?: number;
}

export interface NetPayBreakdown {
  workerId: string;
  daysPresent: number;
  divisor: number;
  baseSalaryPkr: number;
  pieceRateEarningsPkr: number;
  advancesPkr: number;
  deductionsPkr: number;
  netPkr: number;
}

/**
 * Compute net pay for a worker over a period. Combines attendance-driven
 * base pay (or daily wage), piece-rate logs, advances, and deductions.
 */
export async function computeNetPay(input: NetPayInput): Promise<NetPayBreakdown> {
  const [worker] = await db.select().from(workers).where(eq(workers.id, input.workerId)).limit(1);
  if (!worker) throw new Error(`Worker ${input.workerId} not found`);

  const divisor = await payrollDivisorFor(worker.entityId);
  const policy = await resolveHolidayPolicy(worker.entityId);
  const baseDiv = divisor.divisorForPeriod(input.periodStart, input.periodEnd);
  const deduct = await countDeductibleHolidays(input.periodStart, input.periodEnd, policy);
  const div = Math.max(1, baseDiv - deduct);

  const attendance = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.workerId, input.workerId),
        gte(attendanceRecords.workDate, input.periodStart),
        lte(attendanceRecords.workDate, input.periodEnd),
      ),
    );
  const present = attendance.filter((a) => a.status === 'present' || a.status === 'half_day');
  const daysPresent = present.reduce((acc, a) => acc + (a.status === 'half_day' ? 0.5 : 1), 0);

  let baseSalaryPkr = 0;
  if (worker.monthlySalaryPkr) {
    baseSalaryPkr = Number(((Number(worker.monthlySalaryPkr) / div) * daysPresent).toFixed(2));
  } else if (worker.dailyWagePkr) {
    baseSalaryPkr = Number((Number(worker.dailyWagePkr) * daysPresent).toFixed(2));
  }

  const pieceRows = await db
    .select()
    .from(pieceRateLogs)
    .where(
      and(
        eq(pieceRateLogs.workerId, input.workerId),
        gte(pieceRateLogs.workDate, input.periodStart),
        lte(pieceRateLogs.workDate, input.periodEnd),
      ),
    );
  const pieceRateEarningsPkr = pieceRows.reduce((a, r) => a + Number(r.totalPkr), 0);

  const advancesPkr = input.advancesPkr ?? 0;
  const deductionsPkr = input.deductionsPkr ?? 0;
  const netPkr = Number((baseSalaryPkr + pieceRateEarningsPkr - advancesPkr - deductionsPkr).toFixed(2));

  return {
    workerId: input.workerId,
    daysPresent,
    divisor: div,
    baseSalaryPkr,
    pieceRateEarningsPkr,
    advancesPkr,
    deductionsPkr,
    netPkr,
  };
}
