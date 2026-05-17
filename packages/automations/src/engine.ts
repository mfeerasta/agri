import { and, eq, or, sql } from 'drizzle-orm';
import { db, automationRecipes, automationRuns } from '@zameen/db';
import { evaluateConditions } from './conditions.js';
import { executeAction } from './actions.js';
import type { ActionResult, AutomationEvent, Recipe, TriggerKind } from './types.js';

export function evaluateRecipe(recipe: Recipe, event: AutomationEvent): boolean {
  if (!recipe.enabled) return false;
  if (recipe.triggerKind !== event.kind) return false;
  if (recipe.entityId && recipe.entityId !== event.entityId) return false;
  return evaluateConditions(recipe.conditions, event);
}

export async function executeActions(recipe: Recipe, event: AutomationEvent): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const spec of recipe.actions) {
    results.push(await executeAction(spec, event));
  }
  return results;
}

export interface FireOptions {
  dryRun?: boolean;
}

export async function fireTrigger(
  args: { kind: TriggerKind; entityId: string | null; event: AutomationEvent },
  opts: FireOptions = {},
): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(automationRecipes)
      .where(
        and(
          eq(automationRecipes.triggerKind, args.kind),
          eq(automationRecipes.enabled, true),
          args.entityId
            ? or(eq(automationRecipes.entityId, args.entityId), sql`${automationRecipes.entityId} is null`)
            : sql`${automationRecipes.entityId} is null`,
        ),
      );

    for (const row of rows) {
      const recipe: Recipe = {
        id: row.id,
        entityId: row.entityId,
        name: row.name,
        description: row.description ?? null,
        triggerKind: row.triggerKind as TriggerKind,
        triggerConfig: (row.triggerConfig ?? {}) as Record<string, unknown>,
        conditions: (row.conditions ?? []) as Recipe['conditions'],
        actions: (row.actions ?? []) as Recipe['actions'],
        enabled: row.enabled,
      };

      if (!evaluateRecipe(recipe, args.event)) continue;
      if (opts.dryRun) continue;

      const results = await executeActions(recipe, args.event);
      const okCount = results.filter((r) => r.ok).length;
      const status = okCount === results.length ? 'success' : okCount === 0 ? 'failed' : 'partial';

      await db.insert(automationRuns).values({
        recipeId: recipe.id,
        triggeredBy: { kind: args.kind, entityId: args.entityId, payload: args.event.payload },
        actionsExecuted: results,
        status,
        errorMessage: status === 'success' ? null : results.filter((r) => !r.ok).map((r) => r.detail).join('; '),
      });

      await db
        .update(automationRecipes)
        .set({ lastFiredAt: new Date(), fireCount: sql`${automationRecipes.fireCount} + 1` })
        .where(eq(automationRecipes.id, recipe.id));
    }
  } catch (err) {
    // Fire-and-forget: never propagate to the triggering server action.
    // eslint-disable-next-line no-console
    console.error('[automations] fireTrigger failed', err);
  }
}
