'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import {
  db,
  workers,
  bonusRuleSets,
  workerBonusAwards,
  type PerformanceBonusRules,
} from '@zameen/db';
import { computeBonusForPeriod, type ComputeBonusResult } from '@zameen/finance';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type R<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export interface BonusRuleSetInput {
  entityId: string;
  name: string;
  rules: PerformanceBonusRules;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export async function createBonusRuleSet(input: BonusRuleSetInput): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name || !input.entityId) return { ok: false, error: 'Missing required fields' };
  const [row] = await db
    .insert(bonusRuleSets)
    .values({
      entityId: input.entityId,
      name: input.name,
      rules: input.rules,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    })
    .returning();
  revalidatePath('/labor/bonus-rules');
  return { ok: true, id: row!.id };
}

export async function listBonusRuleSets(entityId: string) {
  return db
    .select()
    .from(bonusRuleSets)
    .where(eq(bonusRuleSets.entityId, entityId))
    .orderBy(desc(bonusRuleSets.createdAt));
}

export async function setBonusRuleSetActive({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}): Promise<R> {
  await db.update(bonusRuleSets).set({ isActive }).where(eq(bonusRuleSets.id, id));
  revalidatePath('/labor/bonus-rules');
  return { ok: true, id };
}

export interface BonusAwardPreviewRow extends ComputeBonusResult {
  workerCode: string;
  workerName: string;
}

export interface BonusAwardPreview {
  ruleSetId: string;
  ruleSetName: string;
  periodStart: string;
  periodEnd: string;
  rules: PerformanceBonusRules;
  rows: BonusAwardPreviewRow[];
  totalBonusPkr: number;
}

export async function previewBonusAwards({
  entityId,
  ruleSetId,
  periodStart,
  periodEnd,
}: {
  entityId: string;
  ruleSetId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<BonusAwardPreview> {
  const [rs] = await db
    .select()
    .from(bonusRuleSets)
    .where(and(eq(bonusRuleSets.id, ruleSetId), eq(bonusRuleSets.entityId, entityId)))
    .limit(1);
  if (!rs) throw new Error('Rule set not found');

  const roster = await db
    .select()
    .from(workers)
    .where(and(eq(workers.entityId, entityId), eq(workers.isActive, true)));

  const rows: BonusAwardPreviewRow[] = [];
  let total = 0;
  for (const w of roster) {
    const result = await computeBonusForPeriod({
      entityId,
      workerId: w.id,
      fromDate: periodStart,
      toDate: periodEnd,
      rules: rs.rules,
    });
    if (result.totalBonus <= 0) continue;
    rows.push({ ...result, workerCode: w.code, workerName: w.fullName });
    total += result.totalBonus;
  }
  rows.sort((a, b) => b.totalBonus - a.totalBonus);

  return {
    ruleSetId: rs.id,
    ruleSetName: rs.name,
    periodStart,
    periodEnd,
    rules: rs.rules,
    rows,
    totalBonusPkr: +total.toFixed(2),
  };
}

export async function approveBonusAwards({
  entityId,
  ruleSetId,
  periodStart,
  periodEnd,
}: {
  entityId: string;
  ruleSetId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<R<{ id: string; awarded: number }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const preview = await previewBonusAwards({ entityId, ruleSetId, periodStart, periodEnd });
  if (preview.rows.length === 0) return { ok: false, error: 'No bonuses to award' };

  const awardRows = await db
    .insert(workerBonusAwards)
    .values(
      preview.rows.map((r) => ({
        workerId: r.workerId,
        periodStart,
        periodEnd,
        ruleSetId,
        baseSalaryPkr: r.baseSalary.toFixed(2),
        bonusBreakdown: r.bonusBreakdown,
        totalBonusPkr: r.totalBonus.toFixed(2),
      })),
    )
    .returning();

  const payload = {
    ruleSetId,
    periodStart,
    periodEnd,
    awardCount: awardRows.length,
    totalBonusPkr: preview.totalBonusPkr,
    awardIds: awardRows.map((a) => a.id),
  };
  const contextSnapshot = await buildFullContext({
    entityId,
    approvalType: 'bonus_award',
    payload: payload as Record<string, unknown>,
    requesterUserId: ctx.userId,
    sourceModule: 'labor',
  });
  const approval = await submitApproval({
    entityId,
    approvalType: 'bonus_award',
    sourceModule: 'labor',
    sourceRecordId: ruleSetId,
    title: `Bonus awards ${periodStart} to ${periodEnd} (${awardRows.length} workers)`,
    amountPkr: preview.totalBonusPkr,
    payload,
    contextSnapshot,
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  // tag awards with approval request id
  for (const a of awardRows) {
    await db
      .update(workerBonusAwards)
      .set({ approvalRequestId: approval.id })
      .where(eq(workerBonusAwards.id, a.id));
  }

  revalidatePath('/labor/bonus-awards');
  return { ok: true, id: approval.id, awarded: awardRows.length };
}

export async function listBonusAwards({
  entityId,
  periodStart,
  periodEnd,
}: {
  entityId: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const filters = [eq(workers.entityId, entityId)];
  if (periodStart) filters.push(gte(workerBonusAwards.periodStart, periodStart));
  if (periodEnd) filters.push(lte(workerBonusAwards.periodEnd, periodEnd));
  return db
    .select({
      id: workerBonusAwards.id,
      workerId: workerBonusAwards.workerId,
      workerCode: workers.code,
      workerName: workers.fullName,
      periodStart: workerBonusAwards.periodStart,
      periodEnd: workerBonusAwards.periodEnd,
      baseSalaryPkr: workerBonusAwards.baseSalaryPkr,
      bonusBreakdown: workerBonusAwards.bonusBreakdown,
      totalBonusPkr: workerBonusAwards.totalBonusPkr,
      approvalRequestId: workerBonusAwards.approvalRequestId,
      paidInPayrollRunId: workerBonusAwards.paidInPayrollRunId,
      awardedAt: workerBonusAwards.awardedAt,
    })
    .from(workerBonusAwards)
    .innerJoin(workers, eq(workers.id, workerBonusAwards.workerId))
    .where(and(...filters))
    .orderBy(desc(workerBonusAwards.awardedAt));
}
