import { z } from 'zod';
import { photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const maintenanceTriggerKindSchema = z.enum([
  'hour_meter',
  'days_elapsed',
  'km_traveled',
  'calendar_date',
  'condition_based',
]);
export type MaintenanceTriggerKind = z.infer<typeof maintenanceTriggerKindSchema>;

export const maintenancePartRequiredSchema = z.object({
  name: z.string().min(1).max(256),
  partNumber: z.string().max(64).optional(),
  quantity: z.coerce.number().positive(),
  unitCostPkr: z.coerce.number().nonnegative().optional(),
});

export const maintenanceTaskStepSchema = z.object({
  step: z.string().min(1).max(512),
  stepUr: z.string().max(512).optional(),
  required: z.boolean().default(true),
});

export const maintenancePlanSchema = z.object({
  assetId: uuidSchema,
  name: z.string().min(1).max(256),
  triggerKind: maintenanceTriggerKindSchema,
  triggerValue: z.coerce.number().positive().optional(),
  cronExpression: z.string().max(128).optional(),
  taskTemplate: z.array(maintenanceTaskStepSchema).min(1),
  partsRequired: z.array(maintenancePartRequiredSchema).default([]),
  estimatedCostPkr: pkrAmountSchema.optional(),
  estimatedDowntimeHours: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().default(true),
});
export type MaintenancePlanInput = z.infer<typeof maintenancePlanSchema>;

export const maintenancePartUsedSchema = z.object({
  name: z.string().min(1).max(256),
  partNumber: z.string().max(64).optional(),
  quantity: z.coerce.number().positive(),
  unitCostPkr: z.coerce.number().nonnegative(),
});

export const maintenanceExecutionSchema = z
  .object({
    planId: uuidSchema.optional(),
    assetId: uuidSchema,
    executedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    executedBy: uuidSchema.optional(),
    hourMeterAtService: z.coerce.number().nonnegative().optional(),
    partsUsed: z.array(maintenancePartUsedSchema).default([]),
    laborHours: z.coerce.number().nonnegative().optional(),
    laborCostPkr: z.coerce.number().nonnegative().default(0),
    externalServiceCostPkr: z.coerce.number().nonnegative().default(0),
    notes: z.string().max(4000).optional(),
    photoUrls: photoUrlsSchema.refine((a) => a.length >= 1, 'At least one service photo required'),
  })
  .transform((v) => {
    const partsCostPkr = v.partsUsed.reduce((s, p) => s + p.quantity * p.unitCostPkr, 0);
    const totalCostPkr = Number((partsCostPkr + v.laborCostPkr + v.externalServiceCostPkr).toFixed(2));
    return { ...v, partsCostPkr: Number(partsCostPkr.toFixed(2)), totalCostPkr };
  });
export type MaintenanceExecutionInput = z.infer<typeof maintenanceExecutionSchema>;
