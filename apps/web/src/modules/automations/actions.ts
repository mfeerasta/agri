'use server';
import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { db, automationRecipes, automationRuns } from '@zameen/db';
import { recipeInputSchema, recipePatchSchema, fireTrigger } from '@zameen/automations';
import type { AutomationEvent, TriggerKind } from '@zameen/automations';
import { getSessionContext } from '@/lib/session';

type R<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export async function createRecipe(raw: unknown): Promise<R> {
  const parsed = recipeInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(automationRecipes)
    .values({
      entityId: parsed.data.entityId ?? ctx.entityId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      triggerKind: parsed.data.triggerKind,
      triggerConfig: parsed.data.triggerConfig,
      conditions: parsed.data.conditions,
      actions: parsed.data.actions,
      enabled: parsed.data.enabled,
      createdBy: ctx.userId,
    })
    .returning();
  revalidatePath('/admin/automations');
  return { ok: true, id: row!.id };
}

export async function updateRecipe(id: string, raw: unknown): Promise<R> {
  const parsed = recipePatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(automationRecipes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(automationRecipes.id, id));
  revalidatePath('/admin/automations');
  revalidatePath(`/admin/automations/${id}`);
  return { ok: true, id };
}

export async function deleteRecipe(id: string): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db.delete(automationRecipes).where(eq(automationRecipes.id, id));
  revalidatePath('/admin/automations');
  return { ok: true, id };
}

export async function toggleRecipe(id: string, enabled: boolean): Promise<R> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  await db
    .update(automationRecipes)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(automationRecipes.id, id));
  revalidatePath('/admin/automations');
  return { ok: true, id };
}

export async function testRun(
  id: string,
  eventPayload: Record<string, unknown>,
): Promise<R<{ dryRun: true }>> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db.select().from(automationRecipes).where(eq(automationRecipes.id, id)).limit(1);
  if (!row) return { ok: false, error: 'Recipe not found' };
  const event: AutomationEvent = {
    kind: row.triggerKind as TriggerKind,
    entityId: row.entityId,
    occurredAt: new Date(),
    payload: eventPayload,
  };
  await fireTrigger({ kind: row.triggerKind as TriggerKind, entityId: row.entityId, event }, { dryRun: true });
  return { ok: true, id, dryRun: true };
}

export async function listRuns(recipeId: string) {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  return db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.recipeId, recipeId))
    .orderBy(desc(automationRuns.occurredAt))
    .limit(50);
}

export async function listRecipesForEntity(entityId: string) {
  return db
    .select()
    .from(automationRecipes)
    .where(eq(automationRecipes.entityId, entityId))
    .orderBy(desc(automationRecipes.createdAt));
}
