import { z } from 'zod';
import { ACTION_KINDS, TRIGGER_KINDS } from './types.js';

export const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'exists']),
  value: z.unknown().optional(),
});

export const actionSpecSchema = z.object({
  kind: z.enum(ACTION_KINDS),
  config: z.record(z.unknown()).default({}),
});

export const recipeInputSchema = z.object({
  entityId: z.string().uuid().nullable(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  triggerKind: z.enum(TRIGGER_KINDS),
  triggerConfig: z.record(z.unknown()).default({}),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSpecSchema).min(1, 'at least one action required'),
  enabled: z.boolean().default(true),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

export const recipePatchSchema = recipeInputSchema.partial();
export type RecipePatch = z.infer<typeof recipePatchSchema>;
