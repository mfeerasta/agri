'use server';

/**
 * Feasibility study server actions.
 *
 * Studies are always Director-approved (threshold = 0 for everyone else)
 * per DEFAULT_APPROVAL_THRESHOLDS_PKR. The AI draft is a starter; the
 * Director's edits become the canonical record at submit time.
 */

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, feasibilityStudies, feasibilityComments } from '@zameen/db';
import { submitApproval } from '@zameen/approvals';
import { feasibilityStudySchema } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

function nextStudyNumber(): string {
  return `FS-${Date.now().toString(36).toUpperCase()}`;
}

export async function createFeasibilityStudy(raw: unknown): Promise<Result> {
  const parsed = feasibilityStudySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(feasibilityStudies)
    .values({
      entityId: data.entityId,
      studyNumber: nextStudyNumber(),
      title: data.title,
      titleUr: data.titleUr ?? null,
      proposedBy: ctx.userId,
      background: data.background,
      scope: data.scope,
      capexEstimatePkr: data.capexEstimatePkr.toString(),
      opexEstimatePkr: data.opexEstimatePkr.toString(),
      costBreakdown: data.costBreakdown,
      revenueProjection: data.revenueProjection,
      yieldAssumptions: data.yieldAssumptions ?? null,
      priceAssumptions: data.priceAssumptions ?? null,
      sensitivity: data.sensitivity ?? null,
      riskAssessment: data.riskAssessment,
      statusQuoComparison: data.statusQuoComparison ?? null,
    })
    .returning();

  revalidatePath('/feasibilities');
  return { ok: true, id: row!.id };
}

export async function updateFeasibilityStudy(
  id: string,
  raw: unknown,
): Promise<Result> {
  const parsed = feasibilityStudySchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  await db
    .update(feasibilityStudies)
    .set({
      title: data.title ?? undefined,
      titleUr: data.titleUr ?? undefined,
      background: data.background ?? undefined,
      scope: data.scope ?? undefined,
      capexEstimatePkr: data.capexEstimatePkr?.toString() ?? undefined,
      opexEstimatePkr: data.opexEstimatePkr?.toString() ?? undefined,
      costBreakdown: data.costBreakdown ?? undefined,
      revenueProjection: data.revenueProjection ?? undefined,
      yieldAssumptions: data.yieldAssumptions ?? undefined,
      priceAssumptions: data.priceAssumptions ?? undefined,
      sensitivity: data.sensitivity ?? undefined,
      riskAssessment: data.riskAssessment ?? undefined,
      statusQuoComparison: data.statusQuoComparison ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(feasibilityStudies.id, id));

  revalidatePath(`/feasibilities/${id}`);
  return { ok: true, id };
}

export async function submitFeasibilityForApproval(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [study] = await db
    .select()
    .from(feasibilityStudies)
    .where(eq(feasibilityStudies.id, id))
    .limit(1);
  if (!study) return { ok: false, error: 'Study not found' };

  const amountPkr = Number(study.capexEstimatePkr) + Number(study.opexEstimatePkr);

  const request = await submitApproval({
    entityId: study.entityId,
    approvalType: 'feasibility_study',
    sourceModule: 'feasibility',
    sourceRecordId: study.id,
    title: `Feasibility: ${study.title}`,
    titleUr: study.titleUr ?? undefined,
    amountPkr,
    payload: { feasibilityStudyId: study.id },
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  await db
    .update(feasibilityStudies)
    .set({ approvalRequestId: request.id, updatedAt: new Date() })
    .where(eq(feasibilityStudies.id, id));

  revalidatePath(`/feasibilities/${id}`);
  return { ok: true, id };
}

export async function recordFeasibilityDecision(
  id: string,
  decision: 'approved' | 'conditional_approval' | 'rejected' | 'deferred',
  conditions?: string,
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  await db
    .update(feasibilityStudies)
    .set({
      decision,
      decisionConditions: conditions ?? null,
      updatedAt: new Date(),
    })
    .where(eq(feasibilityStudies.id, id));

  revalidatePath(`/feasibilities/${id}`);
  return { ok: true, id };
}

export async function addFeasibilityComment(
  feasibilityStudyId: string,
  body: string,
  bodyUr?: string,
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!body.trim()) return { ok: false, error: 'Empty comment' };

  const [row] = await db
    .insert(feasibilityComments)
    .values({
      feasibilityStudyId,
      authorId: ctx.userId,
      body,
      bodyUr: bodyUr ?? null,
    })
    .returning();

  revalidatePath(`/feasibilities/${feasibilityStudyId}`);
  return { ok: true, id: row!.id };
}
