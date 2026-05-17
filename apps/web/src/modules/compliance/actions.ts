'use server';
import { revalidatePath } from 'next/cache';
import {
  documentCreateSchema,
  taxFilingSchema,
  subsidyCreateSchema,
  sprayDiarySchema,
} from '@zameen/shared/validators';
import {
  db,
  documents,
  taxFilings,
  subsidyTransactions,
  sprayDiaries,
} from '@zameen/db';
import { submitApproval } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

type R = { ok: true; id: string } | { ok: false; error: string };

export async function uploadDocument(raw: unknown): Promise<R> {
  const parsed = documentCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(documents)
    .values({
      entityId: parsed.data.entityId,
      documentType: parsed.data.documentType,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      mimeType: parsed.data.mimeType ?? null,
      issuedOn: parsed.data.issuedOn ?? null,
      expiresOn: parsed.data.expiresOn ?? null,
      metadata: parsed.data.metadata ?? null,
      uploadedBy: ctx.userId,
    })
    .returning();
  revalidatePath('/compliance/documents');
  return { ok: true, id: row!.id };
}

export async function fileTax(raw: unknown): Promise<R> {
  const parsed = taxFilingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(taxFilings)
    .values({
      entityId: data.entityId,
      taxKind: data.taxKind,
      periodLabel: data.periodLabel,
      amountPkr: data.amountPkr,
      filedOn: data.filedOn ?? null,
      challanNumber: data.challanNumber ?? null,
      challanPhotoUrl: data.challanPhotoUrl ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  await submitApproval({
    entityId: data.entityId,
    approvalType: 'tax_payment',
    sourceModule: 'compliance',
    sourceRecordId: row!.id,
    title: `Tax payment ${data.taxKind} ${data.periodLabel}`,
    amountPkr: Number(data.amountPkr),
    payload: { taxFilingId: row!.id, ...data },
    requestedBy: ctx.userId,
    actorRole: ctx.role,
  });

  revalidatePath('/compliance/tax-filings');
  return { ok: true, id: row!.id };
}

export async function applySubsidy(raw: unknown): Promise<R> {
  const parsed = subsidyCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const [row] = await db
    .insert(subsidyTransactions)
    .values({
      entityId: parsed.data.entityId,
      programName: parsed.data.programName,
      applicationDate: parsed.data.applicationDate,
      amountPkr: parsed.data.amountPkr ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();
  revalidatePath('/compliance/subsidies');
  return { ok: true, id: row!.id };
}

export async function logSprayDiary(raw: unknown): Promise<R> {
  const parsed = sprayDiarySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const [row] = await db
    .insert(sprayDiaries)
    .values({
      entityId: data.entityId,
      fieldId: data.fieldId,
      cropPlanId: data.cropPlanId ?? null,
      sprayedOn: data.sprayedOn,
      pesticideName: data.pesticideName,
      activeIngredient: data.activeIngredient ?? null,
      doseLitresPerAcre: data.doseLitresPerAcre?.toString() ?? null,
      totalLitresUsed: data.totalLitresUsed?.toString() ?? null,
      applicator: data.applicator ?? null,
      weatherConditions: data.weatherConditions ?? null,
      preHarvestIntervalDays: data.preHarvestIntervalDays?.toString() ?? null,
      notes: data.notes ?? null,
    })
    .returning();
  revalidatePath('/compliance/spray-diary');
  return { ok: true, id: row!.id };
}
