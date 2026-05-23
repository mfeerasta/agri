'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  db,
  qualityLabTests,
  gradingStandards,
  cleaningDryingEvents,
  qualityComplaints,
  produceLots,
} from '@zameen/db';
import { submitApproval } from '@zameen/approvals';
import { allocateCost, gradeFromTests } from '@zameen/finance';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

const LAB_TEST_KINDS = [
  'moisture',
  'protein',
  'gluten',
  'foreign_matter',
  'broken_kernels',
  'discoloration',
  'aflatoxin',
  'heavy_metals',
  'pesticide_residue',
  'germination',
  'vigor',
  'seed_purity',
  'grading_standard',
  'other',
] as const;

const POST_HARVEST_EVENT_KINDS = [
  'threshing',
  'cleaning',
  'drying',
  'sorting',
  'grading',
  'bagging',
  'fumigation',
  'treatment',
] as const;

interface LabTestInput {
  produceLotId?: string | null;
  harvestRecordId?: string | null;
  testKind: (typeof LAB_TEST_KINDS)[number];
  testedOn: string;
  laboratory?: string | null;
  labReference?: string | null;
  resultValue?: number | null;
  resultUnit?: string | null;
  resultPassFail?: 'pass' | 'fail' | 'marginal' | null;
  specMin?: number | null;
  specMax?: number | null;
  reportUrl?: string | null;
  notes?: string | null;
}

export async function createLabTest(input: LabTestInput): Promise<Result> {
  if (!LAB_TEST_KINDS.includes(input.testKind)) return { ok: false, error: 'invalid-test-kind' };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(qualityLabTests)
    .values({
      produceLotId: input.produceLotId ?? null,
      harvestRecordId: input.harvestRecordId ?? null,
      testKind: input.testKind,
      testedOn: input.testedOn,
      laboratory: input.laboratory ?? null,
      labReference: input.labReference ?? null,
      resultValue: input.resultValue != null ? input.resultValue.toString() : null,
      resultUnit: input.resultUnit ?? null,
      resultPassFail: input.resultPassFail ?? null,
      specMin: input.specMin != null ? input.specMin.toString() : null,
      specMax: input.specMax != null ? input.specMax.toString() : null,
      reportUrl: input.reportUrl ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  if (input.produceLotId) {
    const [lot] = await db.select().from(produceLots).where(eq(produceLots.id, input.produceLotId)).limit(1);
    if (lot) {
      await gradeFromTests({ lotId: input.produceLotId, entityId: lot.entityId });
    }
  }

  revalidatePath('/app/quality/lab-tests');
  return { ok: true, id: row!.id };
}

interface GradingStandardInput {
  entityId: string | null;
  cropCode: string;
  grade: string;
  criteria: Record<string, number>;
  buyerSpecific?: string | null;
  isActive?: boolean;
}

export async function upsertGradingStandard(input: GradingStandardInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(gradingStandards)
    .values({
      entityId: input.entityId,
      cropCode: input.cropCode,
      grade: input.grade,
      criteria: input.criteria,
      buyerSpecific: input.buyerSpecific ?? null,
      isActive: input.isActive ?? true,
    })
    .returning();

  revalidatePath('/app/quality/grading-standards');
  return { ok: true, id: row!.id };
}

interface PostHarvestEventInput {
  produceLotId: string;
  eventKind: (typeof POST_HARVEST_EVENT_KINDS)[number];
  occurredOn: string;
  inputQuantityKg?: number | null;
  outputQuantityKg?: number | null;
  costPkr?: number | null;
  durationHours?: number | null;
  operatorId?: string | null;
  notes?: string | null;
  photoUrls?: string[];
}

export async function createPostHarvestEvent(input: PostHarvestEventInput): Promise<Result> {
  if (!POST_HARVEST_EVENT_KINDS.includes(input.eventKind)) return { ok: false, error: 'invalid-event-kind' };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [lot] = await db.select().from(produceLots).where(eq(produceLots.id, input.produceLotId)).limit(1);
  if (!lot) return { ok: false, error: 'lot-not-found' };

  const inputKg = input.inputQuantityKg ?? null;
  const outputKg = input.outputQuantityKg ?? null;
  let shrinkageKg: number | null = null;
  let shrinkagePct: number | null = null;
  if (inputKg != null && outputKg != null && inputKg > 0) {
    shrinkageKg = Number((inputKg - outputKg).toFixed(2));
    shrinkagePct = Number(((shrinkageKg / inputKg) * 100).toFixed(2));
  }

  const [row] = await db
    .insert(cleaningDryingEvents)
    .values({
      produceLotId: input.produceLotId,
      eventKind: input.eventKind,
      occurredOn: input.occurredOn,
      inputQuantityKg: inputKg != null ? inputKg.toString() : null,
      outputQuantityKg: outputKg != null ? outputKg.toString() : null,
      shrinkageKg: shrinkageKg != null ? shrinkageKg.toString() : null,
      shrinkagePct: shrinkagePct != null ? shrinkagePct.toString() : null,
      costPkr: input.costPkr != null ? input.costPkr.toString() : null,
      durationHours: input.durationHours != null ? input.durationHours.toString() : null,
      operatorId: input.operatorId ?? null,
      notes: input.notes ?? null,
      photoUrls: input.photoUrls ?? [],
    })
    .returning();

  if (input.costPkr && input.costPkr > 0) {
    await allocateCost({
      entityId: lot.entityId,
      sourceModule: 'other',
      sourceRecordId: row!.id,
      costPool: 'post_harvest',
      amountPkr: input.costPkr,
      allocatedOn: input.occurredOn,
      fieldId: lot.fieldId ?? undefined,
      cropPlanId: lot.cropPlanId ?? undefined,
      notes: `${input.eventKind} on lot ${lot.lotNumber}`,
    });
  }

  revalidatePath('/app/quality/post-harvest');
  return { ok: true, id: row!.id };
}

interface ComplaintInput {
  entityId: string;
  relatedLotId?: string | null;
  relatedDispatchId?: string | null;
  raisedOn: string;
  raisedByBuyer: string;
  complaintKind?: string | null;
  severity: 'minor' | 'medium' | 'major' | 'critical';
  claimedLossPkr?: number | null;
  notes?: string | null;
  photoUrls?: string[];
}

export async function createComplaint(input: ComplaintInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(qualityComplaints)
    .values({
      entityId: input.entityId,
      relatedLotId: input.relatedLotId ?? null,
      relatedDispatchId: input.relatedDispatchId ?? null,
      raisedOn: input.raisedOn,
      raisedByBuyer: input.raisedByBuyer,
      complaintKind: input.complaintKind ?? null,
      severity: input.severity,
      claimedLossPkr: input.claimedLossPkr != null ? input.claimedLossPkr.toString() : null,
      notes: input.notes ?? null,
      photoUrls: input.photoUrls ?? [],
      status: 'open',
    })
    .returning();

  revalidatePath('/app/quality/complaints');
  return { ok: true, id: row!.id };
}

interface ResolveComplaintInput {
  complaintId: string;
  resolution: 'replaced' | 'credit_note' | 'discount' | 'rejected' | 'negotiated' | 'dismissed';
  resolvedPkr: number;
  resolvedOn: string;
  rootCause?: string | null;
  correctiveAction?: string | null;
}

export async function resolveComplaint(input: ResolveComplaintInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [complaint] = await db.select().from(qualityComplaints).where(eq(qualityComplaints.id, input.complaintId)).limit(1);
  if (!complaint) return { ok: false, error: 'complaint-not-found' };

  // Route through approval if resolution amount exceeds farm_manager threshold.
  const thresholds = DEFAULT_APPROVAL_THRESHOLDS_PKR.quality_complaint;
  const needsApproval = thresholds.farm_manager != null && input.resolvedPkr > thresholds.farm_manager;

  let approvalRequestId: string | null = complaint.approvalRequestId ?? null;
  if (needsApproval && !approvalRequestId) {
    const ar = await submitApproval({
      entityId: complaint.entityId,
      approvalType: 'quality_complaint',
      sourceModule: 'other',
      sourceRecordId: complaint.id,
      title: `Complaint ${input.resolution} PKR ${input.resolvedPkr}`,
      amountPkr: input.resolvedPkr,
      payload: {
        complaintId: complaint.id,
        resolution: input.resolution,
        resolvedPkr: input.resolvedPkr,
      },
      contextSnapshot: {
        buyer: complaint.raisedByBuyer,
        kind: complaint.complaintKind,
        severity: complaint.severity,
        claimedLossPkr: complaint.claimedLossPkr ? Number(complaint.claimedLossPkr) : null,
        rootCause: input.rootCause ?? null,
        correctiveAction: input.correctiveAction ?? null,
      },
      requestedBy: ctx.userId,
      actorRole: ctx.role ?? 'supervisor',
    });
    approvalRequestId = ar.id;
  }

  await db
    .update(qualityComplaints)
    .set({
      resolution: input.resolution,
      resolvedPkr: input.resolvedPkr.toString(),
      resolvedOn: input.resolvedOn,
      rootCause: input.rootCause ?? null,
      correctiveAction: input.correctiveAction ?? null,
      approvalRequestId,
      status: needsApproval ? 'investigating' : 'resolved',
    })
    .where(eq(qualityComplaints.id, input.complaintId));

  if (!needsApproval && input.resolvedPkr > 0) {
    await allocateCost({
      entityId: complaint.entityId,
      sourceModule: 'other',
      sourceRecordId: complaint.id,
      costPool: 'quality_complaint',
      amountPkr: input.resolvedPkr,
      allocatedOn: input.resolvedOn,
      notes: `Complaint ${input.resolution} for buyer ${complaint.raisedByBuyer}`,
    });
  }

  revalidatePath('/app/quality/complaints');
  return { ok: true, id: complaint.id };
}

export async function updateComplaintStatus(
  complaintId: string,
  status: 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated',
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.update(qualityComplaints).set({ status }).where(eq(qualityComplaints.id, complaintId));
  revalidatePath('/app/quality/complaints');
  return { ok: true, id: complaintId };
}

export async function loadQualityHubSummary(entityId: string) {
  const [{ lotsTested }] = await db
    .select({ lotsTested: sql<number>`count(distinct ${qualityLabTests.produceLotId})::int` })
    .from(qualityLabTests)
    .leftJoin(produceLots, eq(qualityLabTests.produceLotId, produceLots.id))
    .where(eq(produceLots.entityId, entityId));

  const [{ totalTests, passedTests }] = await db
    .select({
      totalTests: sql<number>`count(*)::int`,
      passedTests: sql<number>`count(*) filter (where ${qualityLabTests.resultPassFail} = 'pass')::int`,
    })
    .from(qualityLabTests)
    .leftJoin(produceLots, eq(qualityLabTests.produceLotId, produceLots.id))
    .where(eq(produceLots.entityId, entityId));

  const [{ openComplaints, totalResolutionCost }] = await db
    .select({
      openComplaints: sql<number>`count(*) filter (where ${qualityComplaints.status} in ('open','investigating','escalated'))::int`,
      totalResolutionCost: sql<number>`coalesce(sum(${qualityComplaints.resolvedPkr}),0)::numeric`,
    })
    .from(qualityComplaints)
    .where(eq(qualityComplaints.entityId, entityId));

  return {
    lotsTested: Number(lotsTested ?? 0),
    passRatePct: totalTests && totalTests > 0 ? Number(((Number(passedTests) / Number(totalTests)) * 100).toFixed(1)) : 0,
    openComplaints: Number(openComplaints ?? 0),
    totalResolutionCostPkr: Number(totalResolutionCost ?? 0),
  };
}

export async function listLabTests(entityId: string) {
  return db
    .select({
      id: qualityLabTests.id,
      produceLotId: qualityLabTests.produceLotId,
      testKind: qualityLabTests.testKind,
      testedOn: qualityLabTests.testedOn,
      laboratory: qualityLabTests.laboratory,
      resultValue: qualityLabTests.resultValue,
      resultUnit: qualityLabTests.resultUnit,
      resultPassFail: qualityLabTests.resultPassFail,
      lotNumber: produceLots.lotNumber,
      cropName: produceLots.cropName,
    })
    .from(qualityLabTests)
    .leftJoin(produceLots, eq(qualityLabTests.produceLotId, produceLots.id))
    .where(eq(produceLots.entityId, entityId))
    .orderBy(desc(qualityLabTests.testedOn))
    .limit(200);
}

export async function listGradingStandards(entityId: string) {
  return db
    .select()
    .from(gradingStandards)
    .where(
      and(
        eq(gradingStandards.isActive, true),
        sql`(${gradingStandards.entityId} = ${entityId} or ${gradingStandards.entityId} is null)`,
      ),
    )
    .orderBy(gradingStandards.cropCode, gradingStandards.grade);
}

export async function listPostHarvestEvents(entityId: string) {
  return db
    .select({
      id: cleaningDryingEvents.id,
      produceLotId: cleaningDryingEvents.produceLotId,
      eventKind: cleaningDryingEvents.eventKind,
      occurredOn: cleaningDryingEvents.occurredOn,
      inputQuantityKg: cleaningDryingEvents.inputQuantityKg,
      outputQuantityKg: cleaningDryingEvents.outputQuantityKg,
      shrinkagePct: cleaningDryingEvents.shrinkagePct,
      costPkr: cleaningDryingEvents.costPkr,
      lotNumber: produceLots.lotNumber,
      cropName: produceLots.cropName,
    })
    .from(cleaningDryingEvents)
    .innerJoin(produceLots, eq(cleaningDryingEvents.produceLotId, produceLots.id))
    .where(eq(produceLots.entityId, entityId))
    .orderBy(desc(cleaningDryingEvents.occurredOn))
    .limit(200);
}

export async function listComplaints(entityId: string) {
  return db
    .select()
    .from(qualityComplaints)
    .where(eq(qualityComplaints.entityId, entityId))
    .orderBy(desc(qualityComplaints.raisedOn))
    .limit(200);
}
