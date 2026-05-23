'use server';

import { revalidatePath } from 'next/cache';
import { db, auditorExportPacks, AUDITOR_PACK_SCOPES, type AuditorPackScope } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { getSessionContext } from '../../../../../lib/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

interface CreateInput {
  periodStart: string;
  periodEnd: string;
  scope: AuditorPackScope;
  scopeModules?: string[];
}

export async function createAuditorPack(input: CreateInput): Promise<{ id: string }> {
  const session = await getSessionContext();
  if (!session) throw new Error('Not authenticated');
  if (!AUDITOR_PACK_SCOPES.includes(input.scope)) throw new Error('Invalid scope');
  if (new Date(input.periodStart) > new Date(input.periodEnd)) {
    throw new Error('periodStart must be before periodEnd');
  }

  const [row] = await db
    .insert(auditorExportPacks)
    .values({
      entityId: session.entityId,
      requestedBy: session.userId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      scope: input.scope,
      scopeModules: input.scopeModules ?? null,
      status: 'building',
    })
    .returning();

  // Fire-and-forget the edge function so the UI returns immediately.
  const sb = await createSupabaseServerClient();
  await sb.functions.invoke('build-auditor-pack', { body: { packId: row.id } });

  revalidatePath('/app/admin/auditor-packs');
  return { id: row.id };
}

export async function resignPackUrl(packId: string): Promise<{ url: string }> {
  const sb = await createSupabaseServerClient();
  const [row] = await db
    .select()
    .from(auditorExportPacks)
    .where(eq(auditorExportPacks.id, packId));
  if (!row || !row.storagePath) throw new Error('Pack not ready');
  const { data, error } = await sb.storage
    .from('auditor-packs')
    .createSignedUrl(row.storagePath, 60 * 60 * 24);
  if (error || !data) throw new Error(error?.message ?? 'sign failed');
  await db
    .update(auditorExportPacks)
    .set({
      downloadCount: (row.downloadCount ?? 0) + 1,
      lastDownloadedAt: new Date(),
    })
    .where(eq(auditorExportPacks.id, packId));
  return { url: data.signedUrl };
}

export async function revokePack(packId: string): Promise<void> {
  await db
    .update(auditorExportPacks)
    .set({ status: 'revoked', downloadUrl: null })
    .where(eq(auditorExportPacks.id, packId));
  revalidatePath('/app/admin/auditor-packs');
}
