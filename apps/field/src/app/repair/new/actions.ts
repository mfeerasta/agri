'use server';
import { revalidatePath } from 'next/cache';
import { db, repairRequests } from '@zameen/db';
import { repairRequestSchema } from '@zameen/shared/validators';
import { getFieldSession } from '../../../lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function submitRepairRequest(raw: unknown): Promise<Result> {
  const parsed = repairRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;
  const session = await getFieldSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .insert(repairRequests)
    .values({
      entityId: data.entityId,
      assetId: data.assetId,
      reportedBy: session.userId,
      issueDescription: data.issueDescription,
      issueDescriptionUr: data.issueDescriptionUr ?? null,
      severity: data.severity,
      suggestedAction: data.suggestedAction ?? null,
      problemPhotoUrls: data.problemPhotoUrls,
    })
    .returning();

  revalidatePath('/');
  return { ok: true, id: row!.id };
}
