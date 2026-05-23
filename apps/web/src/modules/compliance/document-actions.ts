'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, complianceDocuments, governmentSchemes, schemeApplications } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

interface DocumentInput {
  entityId: string;
  docKind: string;
  title: string;
  referenceNumber?: string;
  issuingAuthority?: string;
  issuedOn?: string;
  expiresOn?: string;
  relatedFieldId?: string;
  relatedAssetId?: string;
  relatedWorkerId?: string;
  storageUrl: string;
  notes?: string;
}

export async function createComplianceDocument(input: DocumentInput): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.entityId || !input.docKind || !input.title || !input.storageUrl) {
    return { ok: false, error: 'Missing required fields' };
  }
  const [row] = await db
    .insert(complianceDocuments)
    .values({
      entityId: input.entityId,
      docKind: input.docKind,
      title: input.title,
      referenceNumber: input.referenceNumber ?? null,
      issuingAuthority: input.issuingAuthority ?? null,
      issuedOn: input.issuedOn ?? null,
      expiresOn: input.expiresOn ?? null,
      relatedFieldId: input.relatedFieldId ?? null,
      relatedAssetId: input.relatedAssetId ?? null,
      relatedWorkerId: input.relatedWorkerId ?? null,
      storageUrl: input.storageUrl,
      notes: input.notes ?? null,
      status: 'active',
    })
    .returning();
  revalidatePath('/compliance/documents');
  return { ok: true, id: row!.id };
}

export async function renewComplianceDocument(
  oldId: string,
  newInput: DocumentInput,
): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const created = await createComplianceDocument(newInput);
  if (!created.ok) return created;
  await db
    .update(complianceDocuments)
    .set({ status: 'superseded', supersededById: created.id, updatedAt: new Date() })
    .where(eq(complianceDocuments.id, oldId));
  revalidatePath('/compliance/documents');
  return created;
}

export async function markDocumentStatus(
  docId: string,
  status: 'active' | 'expired' | 'renewing' | 'superseded' | 'lost',
): Promise<R> {
  await db
    .update(complianceDocuments)
    .set({ status, updatedAt: new Date() })
    .where(eq(complianceDocuments.id, docId));
  revalidatePath('/compliance/documents');
  return { ok: true, id: docId };
}

interface SchemeAppInput {
  entityId: string;
  schemeId: string;
  appliedOn?: string;
  referenceNumber?: string;
  applicantName?: string;
  expectedBenefitPkr?: string;
  notes?: string;
  attachments?: string[];
}

export async function createSchemeApplication(input: SchemeAppInput): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.entityId || !input.schemeId) {
    return { ok: false, error: 'Missing entity or scheme' };
  }
  const [row] = await db
    .insert(schemeApplications)
    .values({
      entityId: input.entityId,
      schemeId: input.schemeId,
      appliedOn: input.appliedOn ?? null,
      referenceNumber: input.referenceNumber ?? null,
      applicantName: input.applicantName ?? null,
      status: 'planning',
      expectedBenefitPkr: input.expectedBenefitPkr ?? null,
      notes: input.notes ?? null,
      attachments: (input.attachments ?? []) as unknown as object,
    })
    .returning();
  revalidatePath('/compliance/schemes');
  return { ok: true, id: row!.id };
}

export async function updateSchemeApplicationStatus(
  appId: string,
  status:
    | 'planning'
    | 'prepared'
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'disbursed'
    | 'closed',
  patch?: { actualBenefitPkr?: string; disbursedOn?: string; notes?: string },
): Promise<R> {
  await db
    .update(schemeApplications)
    .set({
      status,
      actualBenefitPkr: patch?.actualBenefitPkr ?? undefined,
      disbursedOn: patch?.disbursedOn ?? undefined,
      notes: patch?.notes ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(schemeApplications.id, appId));
  revalidatePath('/compliance/schemes');
  return { ok: true, id: appId };
}

export async function listActiveSchemes() {
  return db
    .select()
    .from(governmentSchemes)
    .where(eq(governmentSchemes.isActive, true));
}

export async function listEntitySchemeApplications(entityId: string) {
  return db
    .select()
    .from(schemeApplications)
    .where(and(eq(schemeApplications.entityId, entityId)));
}
