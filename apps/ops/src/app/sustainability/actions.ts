'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import {
  db,
  sustainabilityPractices,
  carbonAssessments,
  carbonCredits,
  esgMetricsSnapshots,
} from '@zameen/db';
import { computeCarbonFootprint, sustainabilityScore } from '@zameen/finance';
import { submitApproval } from '@zameen/approvals';
import {
  sustainabilityPracticeSchema,
  carbonAssessmentSchema,
  carbonCreditIssuanceSchema,
  carbonCreditSaleSchema,
  carbonCreditRetirementSchema,
  esgSnapshotSchema,
} from '@zameen/shared/validators';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export async function createSustainabilityPractice(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = sustainabilityPracticeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const p = parsed.data;
  if (p.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };
  const [row] = await db
    .insert(sustainabilityPractices)
    .values({
      entityId: p.entityId,
      fieldId: p.fieldId ?? null,
      practiceKind: p.practiceKind,
      startedOn: p.startedOn,
      endedOn: p.endedOn ?? null,
      areaAcres: p.areaAcres != null ? String(p.areaAcres) : null,
      baselineMetric: p.baselineMetric ?? null,
      currentMetric: p.currentMetric ?? null,
      evidenceUrls: p.evidenceUrls ?? [],
      verifier: p.verifier ?? null,
      verificationDate: p.verificationDate ?? null,
      certification: p.certification ?? null,
      notes: p.notes ?? null,
      isActive: true,
    })
    .returning();
  revalidatePath('/sustainability');
  revalidatePath('/sustainability/practices');
  return { ok: true, id: row.id };
}

export async function deactivateSustainabilityPractice(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(sustainabilityPractices)
    .set({ isActive: false, endedOn: new Date().toISOString().slice(0, 10) })
    .where(and(eq(sustainabilityPractices.id, id), eq(sustainabilityPractices.entityId, ctx.entityId)));
  revalidatePath('/sustainability/practices');
  return { ok: true, id };
}

export async function runCarbonAssessment(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = carbonAssessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const a = parsed.data;
  if (a.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };

  const footprint = await computeCarbonFootprint({
    entityId: a.entityId,
    fromDate: a.fromDate,
    toDate: a.toDate,
    estimatedTubewellKwh: a.estimatedTubewellKwh,
    estimatedInputTransportTonKm: a.estimatedInputTransportTonKm,
  });

  let reductionPct: string | null = null;
  if (a.baselineYear) {
    // Look up baseline assessment for the baseline year if exists.
    const baselineStart = `${a.baselineYear}-01-01`;
    const baselineEnd = `${a.baselineYear}-12-31`;
    const baseline = await db
      .select()
      .from(carbonAssessments)
      .where(and(eq(carbonAssessments.entityId, a.entityId)))
      .then((rows) =>
        rows.find((r) => r.assessmentDate >= baselineStart && r.assessmentDate <= baselineEnd),
      );
    if (baseline) {
      const base = Number(baseline.netCo2eTons);
      if (base > 0) {
        reductionPct = (((base - footprint.netCo2eTons) / base) * 100).toFixed(2);
      }
    }
  }

  const [row] = await db
    .insert(carbonAssessments)
    .values({
      entityId: a.entityId,
      fieldId: a.fieldId ?? null,
      assessmentDate: a.assessmentDate,
      scopeCo2eTons: footprint.scopeCo2eTons,
      totalEmissionsCo2eTons: String(footprint.totalEmissionsCo2eTons),
      totalSequestrationCo2eTons: String(footprint.totalSequestrationCo2eTons),
      netCo2eTons: String(footprint.netCo2eTons),
      baselineYear: a.baselineYear ?? null,
      reductionVsBaselinePct: reductionPct,
      methodology: a.methodology ?? 'IPCC tier-1 + farm activity data',
      notes: a.notes ?? footprint.notes.join('; '),
    })
    .returning();
  revalidatePath('/sustainability');
  revalidatePath('/sustainability/carbon-footprint');
  return { ok: true, id: row.id };
}

export async function issueCarbonCredits(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = carbonCreditIssuanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const c = parsed.data;
  if (c.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };
  const [row] = await db
    .insert(carbonCredits)
    .values({
      entityId: c.entityId,
      creditNumber: c.creditNumber ?? null,
      issuedBy: c.issuedBy ?? null,
      standard: c.standard,
      issuedOn: c.issuedOn ?? null,
      vintageYear: c.vintageYear,
      quantityTco2e: String(c.quantityTco2e),
      status: 'issued',
      relatedPracticeIds: c.relatedPracticeIds ?? null,
      relatedAssessmentId: c.relatedAssessmentId ?? null,
      certificateUrl: c.certificateUrl ?? null,
      notes: c.notes ?? null,
    })
    .returning();
  revalidatePath('/sustainability/credits');
  return { ok: true, id: row.id };
}

export async function proposeCarbonCreditSale(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = carbonCreditSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const s = parsed.data;
  const [credit] = await db
    .select()
    .from(carbonCredits)
    .where(and(eq(carbonCredits.id, s.creditId), eq(carbonCredits.entityId, ctx.entityId)));
  if (!credit) return { ok: false, error: 'Credit not found' };
  if (credit.status !== 'issued') return { ok: false, error: `Credit cannot be sold from status ${credit.status}` };
  const qty = Number(credit.quantityTco2e);
  const revenue = qty * s.soldPricePerTonPkr;
  await db
    .update(carbonCredits)
    .set({
      status: 'pending',
      soldTo: s.soldTo,
      soldOn: s.soldOn,
      soldPricePerTonPkr: String(s.soldPricePerTonPkr),
      totalRevenuePkr: String(revenue),
      notes: s.notes ?? credit.notes,
    })
    .where(eq(carbonCredits.id, s.creditId));
  const ap = await submitApproval({
    entityId: ctx.entityId,
    approvalType: 'carbon_credit_sale',
    sourceModule: 'sustainability',
    sourceRecordId: s.creditId,
    title: `Carbon credit sale — ${qty} tCO2e to ${s.soldTo}`,
    amountPkr: revenue,
    payload: { creditId: s.creditId, qty, pricePerTonPkr: s.soldPricePerTonPkr, soldTo: s.soldTo, soldOn: s.soldOn },
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });
  revalidatePath('/sustainability/credits');
  return { ok: true, id: ap.id };
}

export async function retireCarbonCredits(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = carbonCreditRetirementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const r = parsed.data;
  const [credit] = await db
    .select()
    .from(carbonCredits)
    .where(and(eq(carbonCredits.id, r.creditId), eq(carbonCredits.entityId, ctx.entityId)));
  if (!credit) return { ok: false, error: 'Credit not found' };
  if (credit.status !== 'issued') return { ok: false, error: 'Only issued credits can be retired' };
  await db
    .update(carbonCredits)
    .set({ status: 'retired', retirementReason: r.retirementReason })
    .where(eq(carbonCredits.id, r.creditId));
  revalidatePath('/sustainability/credits');
  return { ok: true, id: r.creditId };
}

export async function createEsgSnapshot(input: unknown): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = esgSnapshotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const s = parsed.data;
  if (s.entityId !== ctx.entityId) return { ok: false, error: 'Entity mismatch' };
  const [row] = await db
    .insert(esgMetricsSnapshots)
    .values({
      entityId: s.entityId,
      snapshotDate: s.snapshotDate,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      environmental: s.environmental,
      social: s.social,
      governance: s.governance,
      framework: s.framework ?? 'GRI-aligned',
      notes: s.notes ?? null,
    })
    .returning();
  revalidatePath('/sustainability');
  revalidatePath('/sustainability/esg-report');
  return { ok: true, id: row.id };
}

export async function computeFootprintSummary(fromDate: string, toDate: string) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const fp = await computeCarbonFootprint({ entityId: ctx.entityId, fromDate, toDate });
  return { fp, score: sustainabilityScore(fp) };
}
