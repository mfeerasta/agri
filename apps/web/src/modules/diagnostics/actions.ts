'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, cropDiagnostics } from '@zameen/db';
import { cropDiagnosticReviewSchema } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function reviewDiagnostic(raw: unknown): Promise<Result> {
  const parsed = cropDiagnosticReviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [row] = await db
    .update(cropDiagnostics)
    .set({
      status: parsed.data.status,
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
    })
    .where(eq(cropDiagnostics.id, parsed.data.id))
    .returning();
  if (!row) return { ok: false, error: 'Not found' };

  revalidatePath('/diagnostics');
  revalidatePath(`/diagnostics/${parsed.data.id}`);
  return { ok: true, id: row.id };
}
