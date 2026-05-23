'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import {
  db,
  kpiActuals,
  kpiDefinitions,
  stakeholderReports,
  stakeholders,
  type StakeholderKind,
  type ReportingFrequency,
} from '@zameen/db';
import {
  buildReport,
  computeNextDue,
  persistReportSnapshot,
} from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export interface CreateStakeholderInput {
  name: string;
  stakeholderKind: StakeholderKind;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  exposurePkr?: number;
  reportingFrequency: ReportingFrequency;
  nextReportDue?: string;
  reportingRequirements?: Record<string, unknown>;
  signedAgreementUrl?: string;
}

export async function createStakeholder(input: CreateStakeholderInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name || !input.name.trim()) return { ok: false, error: 'Name required' };

  const [row] = await db
    .insert(stakeholders)
    .values({
      entityId: ctx.entityId,
      name: input.name.trim(),
      stakeholderKind: input.stakeholderKind,
      contactPerson: input.contactPerson ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      exposurePkr: input.exposurePkr == null ? null : String(input.exposurePkr),
      reportingFrequency: input.reportingFrequency,
      nextReportDue: input.nextReportDue ?? null,
      reportingRequirements: input.reportingRequirements ?? null,
      signedAgreementUrl: input.signedAgreementUrl ?? null,
      isActive: true,
    })
    .returning({ id: stakeholders.id });

  revalidatePath('/stakeholders');
  return { ok: true, id: row.id };
}

export async function generateReport(input: {
  stakeholderId: string;
  periodStart: string;
  periodEnd: string;
  dueDate?: string;
  coverLetter?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [st] = await db.select().from(stakeholders).where(eq(stakeholders.id, input.stakeholderId));
  if (!st || st.entityId !== ctx.entityId) return { ok: false, error: 'Stakeholder not found' };

  const snapshot = await buildReport({
    stakeholderId: input.stakeholderId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dueDate: input.dueDate,
  });
  const id = await persistReportSnapshot(
    { stakeholderId: input.stakeholderId, periodStart: input.periodStart, periodEnd: input.periodEnd, dueDate: input.dueDate },
    snapshot,
    null,
  );
  if (input.coverLetter) {
    await db.update(stakeholderReports).set({ coverLetter: input.coverLetter }).where(eq(stakeholderReports.id, id));
  }

  if (st.nextReportDue) {
    const next = computeNextDue(st.reportingFrequency, st.nextReportDue);
    await db.update(stakeholders).set({ nextReportDue: next }).where(eq(stakeholders.id, st.id));
  }

  revalidatePath('/stakeholders');
  revalidatePath(`/stakeholders/${input.stakeholderId}`);
  return { ok: true, id };
}

export async function setReportStatus(reportId: string, status: 'draft' | 'review' | 'approved' | 'submitted' | 'acknowledged' | 'overdue'): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const patch: Record<string, unknown> = { status };
  if (status === 'submitted') patch.submittedOn = new Date().toISOString().slice(0, 10);
  await db.update(stakeholderReports).set(patch).where(eq(stakeholderReports.id, reportId));
  revalidatePath('/stakeholders');
  return { ok: true, id: reportId };
}

export interface KpiDefinitionInput {
  code: string;
  name: string;
  category: 'financial' | 'operational' | 'social' | 'environmental' | 'governance';
  unit: string;
  formulaDescription?: string;
  targetValue?: number;
  targetPeriod?: string;
}

export async function createKpiDefinition(input: KpiDefinitionInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(kpiDefinitions)
    .values({
      entityId: ctx.entityId,
      code: input.code,
      name: input.name,
      category: input.category,
      unit: input.unit,
      formulaDescription: input.formulaDescription ?? null,
      targetValue: input.targetValue == null ? null : String(input.targetValue),
      targetPeriod: input.targetPeriod ?? null,
      isActive: true,
    })
    .returning({ id: kpiDefinitions.id });
  revalidatePath('/stakeholders/kpis');
  return { ok: true, id: row.id };
}

export async function recordKpiActual(input: {
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  targetValue?: number;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [def] = await db.select().from(kpiDefinitions).where(eq(kpiDefinitions.id, input.kpiId));
  if (!def) return { ok: false, error: 'KPI not found' };
  if (def.entityId && def.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };

  const target = input.targetValue ?? (def.targetValue == null ? null : Number(def.targetValue));
  const variancePct = target != null && target !== 0 ? Number((((input.value - target) / target) * 100).toFixed(2)) : null;

  const [row] = await db
    .insert(kpiActuals)
    .values({
      kpiId: input.kpiId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      value: String(input.value),
      targetValue: target == null ? null : String(target),
      variancePct: variancePct == null ? null : String(variancePct),
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [kpiActuals.kpiId, kpiActuals.periodStart, kpiActuals.periodEnd],
      set: {
        value: String(input.value),
        targetValue: target == null ? null : String(target),
        variancePct: variancePct == null ? null : String(variancePct),
        notes: input.notes ?? null,
      },
    })
    .returning({ id: kpiActuals.id });
  revalidatePath('/stakeholders/kpis');
  revalidatePath(`/stakeholders/kpis/${input.kpiId}`);
  return { ok: true, id: row.id };
}

export async function deactivateStakeholder(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(stakeholders)
    .set({ isActive: false })
    .where(and(eq(stakeholders.id, id), eq(stakeholders.entityId, ctx.entityId)));
  revalidatePath('/stakeholders');
  return { ok: true, id };
}
