'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, insurancePolicies, insuranceClaims } from '@zameen/db';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { postJournal } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export interface CreatePolicyInput {
  entityId: string;
  policyNumber: string;
  insurerName: string;
  policyKind: 'crop' | 'livestock' | 'asset' | 'liability' | 'health';
  coveragePkr: number;
  premiumPkr: number;
  effectiveFrom: string;
  effectiveTo: string;
  fieldsCovered?: string[];
  animalsCovered?: string[];
  assetsCovered?: string[];
  attachedDocId?: string;
}

export async function createPolicy(input: CreatePolicyInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.policyNumber || !input.insurerName) return { ok: false, error: 'Policy number and insurer required' };
  if (input.coveragePkr <= 0 || input.premiumPkr <= 0) return { ok: false, error: 'Coverage and premium must be positive' };
  if (input.effectiveFrom >= input.effectiveTo) return { ok: false, error: 'Effective range invalid' };

  const [row] = await db
    .insert(insurancePolicies)
    .values({
      entityId: input.entityId,
      policyNumber: input.policyNumber,
      insurerName: input.insurerName,
      policyKind: input.policyKind,
      coveragePkr: input.coveragePkr.toFixed(2),
      premiumPkr: input.premiumPkr.toFixed(2),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      fieldsCovered: input.fieldsCovered ?? [],
      animalsCovered: input.animalsCovered ?? [],
      assetsCovered: input.assetsCovered ?? [],
      attachedDocId: input.attachedDocId ?? null,
      status: 'active',
    })
    .returning();
  if (!row) return { ok: false, error: 'Insert failed' };

  const t = DEFAULT_APPROVAL_THRESHOLDS_PKR.insurance;
  const premium = input.premiumPkr;
  const needs =
    (t.supervisor !== null && premium > t.supervisor) ||
    (t.farm_manager !== null && premium > t.farm_manager) ||
    (t.director !== null && premium > t.director);
  if (needs) {
    const payload = { policyId: row.id, ...input };
    const contextSnapshot = await buildFullContext({
      entityId: input.entityId,
      approvalType: 'insurance',
      payload: payload as Record<string, unknown>,
      requesterUserId: ctx.userId,
      sourceModule: 'insurance',
    });
    const req = await submitApproval({
      entityId: input.entityId,
      approvalType: 'insurance',
      sourceModule: 'insurance',
      sourceRecordId: row.id,
      title: `Insurance policy ${input.policyNumber} (${input.insurerName})`,
      amountPkr: premium,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
    await db.update(insurancePolicies).set({ approvalRequestId: req.id }).where(eq(insurancePolicies.id, row.id));
  }

  revalidatePath('/compliance/insurance');
  return { ok: true, id: row.id };
}

export async function updatePolicy(
  id: string,
  patch: Partial<Pick<CreatePolicyInput, 'effectiveTo' | 'coveragePkr' | 'premiumPkr'>> & { status?: 'active' | 'expired' | 'cancelled' },
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const updates: Record<string, unknown> = {};
  if (patch.effectiveTo) updates.effectiveTo = patch.effectiveTo;
  if (patch.coveragePkr !== undefined) updates.coveragePkr = patch.coveragePkr.toFixed(2);
  if (patch.premiumPkr !== undefined) updates.premiumPkr = patch.premiumPkr.toFixed(2);
  if (patch.status) updates.status = patch.status;
  await db.update(insurancePolicies).set(updates).where(eq(insurancePolicies.id, id));
  revalidatePath('/compliance/insurance');
  revalidatePath(`/compliance/insurance/policies/${id}`);
  return { ok: true, id };
}

export async function markPolicyExpired(id: string): Promise<Result> {
  await db.update(insurancePolicies).set({ status: 'expired' }).where(eq(insurancePolicies.id, id));
  revalidatePath('/compliance/insurance');
  return { ok: true, id };
}

export interface CreateClaimInput {
  policyId: string;
  incidentDate: string;
  cause: 'hail' | 'flood' | 'frost' | 'fire' | 'theft' | 'disease' | 'pest' | 'drought';
  affectedFieldIds?: string[];
  affectedAnimalIds?: string[];
  estimatedLossPkr: number;
  claimedPkr: number;
  notes?: string;
  photoUrls: string[];
}

export async function createClaim(input: CreateClaimInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.photoUrls || input.photoUrls.length === 0) {
    return { ok: false, error: 'At least one incident photo is required for insurance claims' };
  }
  if (input.estimatedLossPkr <= 0 || input.claimedPkr <= 0) return { ok: false, error: 'Loss and claim amounts must be positive' };

  const [row] = await db
    .insert(insuranceClaims)
    .values({
      policyId: input.policyId,
      incidentDate: input.incidentDate,
      cause: input.cause,
      affectedFieldIds: input.affectedFieldIds ?? [],
      affectedAnimalIds: input.affectedAnimalIds ?? [],
      estimatedLossPkr: input.estimatedLossPkr.toFixed(2),
      claimedPkr: input.claimedPkr.toFixed(2),
      status: 'reported',
      notes: input.notes ?? null,
      photoUrls: input.photoUrls,
      createdBy: ctx.userId,
    })
    .returning();
  if (!row) return { ok: false, error: 'Insert failed' };

  revalidatePath('/compliance/insurance');
  revalidatePath(`/compliance/insurance/policies/${input.policyId}`);
  return { ok: true, id: row.id };
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  reported: ['assessor_pending', 'rejected'],
  assessor_pending: ['assessor_done', 'rejected'],
  assessor_done: ['approved', 'rejected'],
  approved: ['paid', 'closed'],
  paid: ['closed'],
  rejected: ['closed'],
  closed: [],
};

export async function updateClaimStatus(
  id: string,
  status: 'assessor_pending' | 'assessor_done' | 'approved' | 'rejected' | 'paid' | 'closed',
  settledPkr?: number,
  notes?: string,
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [claim] = await db.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1);
  if (!claim) return { ok: false, error: 'Claim not found' };
  const allowed = ALLOWED_TRANSITIONS[claim.status] ?? [];
  if (!allowed.includes(status)) {
    return { ok: false, error: `Cannot transition ${claim.status} -> ${status}` };
  }

  const updates: Record<string, unknown> = { status };
  if (settledPkr !== undefined) updates.settledPkr = settledPkr.toFixed(2);
  if (notes) updates.notes = notes;
  await db.update(insuranceClaims).set(updates).where(eq(insuranceClaims.id, id));

  if (status === 'paid' && settledPkr && settledPkr > 0) {
    const [policy] = await db.select().from(insurancePolicies).where(eq(insurancePolicies.id, claim.policyId)).limit(1);
    if (policy) {
      const today = new Date().toISOString().slice(0, 10);
      await postJournal({
        entityId: policy.entityId,
        journalNumber: `INS-CLM-${id.slice(0, 8).toUpperCase()}`,
        postedOn: today,
        narration: `Insurance claim settlement: ${policy.insurerName} policy ${policy.policyNumber}`,
        sourceModule: 'insurance',
        sourceRecordId: id,
        postedBy: ctx.userId,
        lines: [
          { accountCode: '1000', debitPkr: settledPkr, narration: 'Cash received from insurer' },
          { accountCode: '4900', creditPkr: settledPkr, narration: 'Insurance claim income' },
        ],
      });
    }
  }

  revalidatePath('/compliance/insurance');
  revalidatePath(`/compliance/insurance/claims/${id}`);
  return { ok: true, id };
}
