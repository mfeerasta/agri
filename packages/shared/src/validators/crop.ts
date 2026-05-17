import { z } from 'zod';
import { dateIsoSchema, photoUrlsSchema, pkrAmountSchema, timestampIsoSchema, uuidSchema } from './common.js';

export const cropPlanCreateSchema = z.object({
  entityId: uuidSchema,
  fieldId: uuidSchema,
  cropProfileId: uuidSchema,
  season: z.enum(['rabi', 'kharif', 'zaid', 'perennial']),
  seasonLabel: z.string().min(1).max(32),
  varietyName: z.string().max(256).optional(),
  plannedSowingDate: timestampIsoSchema,
  plannedAcres: z.coerce.number().positive(),
  expectedYieldPerAcre: z.coerce.number().nonnegative().optional(),
  budgetPkr: pkrAmountSchema,
});
export type CropPlanCreateInput = z.infer<typeof cropPlanCreateSchema>;

export const cropStageLogCreateSchema = z.object({
  cropPlanId: uuidSchema,
  stage: z.enum([
    'planned',
    'land_prep',
    'sowing',
    'germination',
    'vegetative',
    'flowering',
    'fruiting',
    'maturity',
    'harvest',
    'post_harvest',
  ]),
  observedOn: timestampIsoSchema,
  notes: z.string().max(4000).optional(),
  notesUr: z.string().max(4000).optional(),
  photoUrls: photoUrlsSchema,
});
export type CropStageLogCreateInput = z.infer<typeof cropStageLogCreateSchema>;

export const harvestRecordCreateSchema = z.object({
  entityId: uuidSchema,
  cropPlanId: uuidSchema,
  harvestedOn: timestampIsoSchema,
  acresHarvested: z.coerce.number().positive(),
  grossYieldKg: z.coerce.number().positive(),
  moisturePct: z.coerce.number().nonnegative().optional(),
  laborCostPkr: z.coerce.number().nonnegative().optional(),
  machineryCostPkr: z.coerce.number().nonnegative().optional(),
  storageLocationId: uuidSchema.optional(),
  lotNumber: z.string().min(1).max(32),
  grade: z.enum(['a', 'b', 'c']).default('a'),
  notes: z.string().max(4000).optional(),
});
export type HarvestRecordCreateInput = z.infer<typeof harvestRecordCreateSchema>;

export const dailyTaskInputSchema = z.object({
  cropPlanId: uuidSchema,
  fieldId: uuidSchema,
  scheduledFor: dateIsoSchema,
  title: z.string().min(1).max(256),
  crew: z.string().max(256).optional(),
  acres: z.coerce.number().nonnegative().optional(),
});
