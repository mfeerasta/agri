'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, insuranceClaims } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true } | { ok: false; error: string };

export async function updateClaimNotes(id: string, notes: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.update(insuranceClaims).set({ notes }).where(eq(insuranceClaims.id, id));
  revalidatePath(`/finance/insurance/claims/${id}`);
  revalidatePath(`/compliance/insurance/claims/${id}`);
  return { ok: true };
}
