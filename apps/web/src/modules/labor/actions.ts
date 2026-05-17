'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, gte, lte } from 'drizzle-orm';
import {
  workerCreateSchema,
  pieceRateSchema,
  payrollRunSchema,
  taskAssignSchema,
} from '@zameen/shared/validators';
import {
  db,
  workers,
  pieceRateLogs,
  payrollRuns,
  payslips,
  taskAssignments,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import { computeNetPay } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function createWorker(raw: unknown): Promise<R> {
  const parsed = workerCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(workers)
    .values({
      entityId: data.entityId,
      code: data.code,
      fullName: data.fullName,
      fullNameUr: data.fullNameUr ?? null,
      phone: data.phone ?? null,
      cnicLast4: data.cnicLast4 ?? null,
      workerType: data.workerType,
      monthlySalaryPkr: data.monthlySalaryPkr ?? null,
      dailyWagePkr: data.dailyWagePkr ?? null,
      hireDate: data.hireDate,
      notes: data.notes ?? null,
    })
    .returning();

  if (data.workerType === 'permanent') {
    const payload = { workerId: row!.id, ...data };
    const contextSnapshot = await buildFullContext({
      entityId: data.entityId,
      approvalType: 'labor_hire',
      payload: payload as Record<string, unknown>,
      requesterUserId: ctx.userId,
      sourceModule: 'labor',
    });
    await submitApproval({
      entityId: data.entityId,
      approvalType: 'labor_hire',
      sourceModule: 'labor',
      sourceRecordId: row!.id,
      title: `Hire permanent worker ${data.fullName}`,
      amountPkr: Number(data.monthlySalaryPkr ?? 0),
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }

  revalidatePath('/labor');
  return { ok: true, id: row!.id };
}

export async function logPieceRate(raw: unknown): Promise<R> {
  const parsed = pieceRateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const totalPkr = Number((data.quantity * data.ratePerUnitPkr).toFixed(2));
  const [row] = await db
    .insert(pieceRateLogs)
    .values({
      workerId: data.workerId,
      taskId: data.taskId ?? null,
      workDate: data.workDate,
      workKind: data.workKind,
      unit: data.unit,
      quantity: data.quantity.toString(),
      ratePerUnitPkr: data.ratePerUnitPkr.toString(),
      totalPkr: totalPkr.toFixed(2),
      fieldId: data.fieldId,
      recordedBy: ctx.userId,
    })
    .returning();

  await allocateCost({
    entityId: data.entityId,
    sourceModule: 'labor',
    sourceRecordId: row!.id,
    fieldId: data.fieldId,
    costPool: 'labor_field',
    amountPkr: totalPkr,
    allocatedOn: data.workDate,
    allocationKey: 'direct',
  });
  revalidatePath('/labor/piece-rate');
  return { ok: true, id: row!.id };
}

export async function initiatePayrollRun(raw: unknown): Promise<R> {
  const parsed = payrollRunSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const activeWorkers = await db
    .select()
    .from(workers)
    .where(and(eq(workers.entityId, data.entityId), eq(workers.isActive, true)));

  let totalPkr = 0;
  const slips: Array<{ workerId: string; daysPresent: number; baseSalaryPkr: number; pieceRateEarningsPkr: number; netPkr: number; breakdown: unknown }> = [];
  for (const w of activeWorkers) {
    const result = await computeNetPay({
      workerId: w.id,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    });
    totalPkr += result.netPkr;
    slips.push({
      workerId: w.id,
      daysPresent: result.daysPresent,
      baseSalaryPkr: result.baseSalaryPkr,
      pieceRateEarningsPkr: result.pieceRateEarningsPkr,
      netPkr: result.netPkr,
      breakdown: result,
    });
  }

  const [run] = await db
    .insert(payrollRuns)
    .values({
      entityId: data.entityId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      status: 'pending_approval',
      totalPkr: totalPkr.toFixed(2),
      runBy: ctx.userId,
    })
    .returning();

  if (slips.length > 0) {
    await db.insert(payslips).values(
      slips.map((s) => ({
        payrollRunId: run!.id,
        workerId: s.workerId,
        daysWorked: s.daysPresent.toString(),
        baseSalaryPkr: s.baseSalaryPkr.toFixed(2),
        pieceRateEarningsPkr: s.pieceRateEarningsPkr.toFixed(2),
        netPkr: s.netPkr.toFixed(2),
        breakdown: s.breakdown,
      })),
    );
  }

  const payrollPayload = { payrollRunId: run!.id, slipCount: slips.length };
  const payrollContext = await buildFullContext({
    entityId: data.entityId,
    approvalType: 'labor_hire',
    payload: payrollPayload,
    requesterUserId: ctx.userId,
    sourceModule: 'labor',
  });
  await submitApproval({
    entityId: data.entityId,
    approvalType: 'labor_hire',
    sourceModule: 'labor',
    sourceRecordId: run!.id,
    title: `Payroll run ${data.periodStart} to ${data.periodEnd}`,
    amountPkr: totalPkr,
    payload: payrollPayload,
    contextSnapshot: payrollContext,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  revalidatePath('/labor/payroll');
  return { ok: true, id: run!.id };
}

export async function assignTask(raw: unknown): Promise<R> {
  const parsed = taskAssignSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  if (parsed.data.workerIds.length === 0) return { ok: false, error: 'No workers selected' };
  await db
    .insert(taskAssignments)
    .values(parsed.data.workerIds.map((w) => ({ taskId: parsed.data.taskId, workerId: w })));
  revalidatePath('/labor/tasks');
  return { ok: true, id: parsed.data.taskId };
}
