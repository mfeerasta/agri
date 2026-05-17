import { z } from 'zod';
import { dateIsoSchema, photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const animalCreateSchema = z.object({
  entityId: uuidSchema,
  earTag: z.string().min(1).max(32),
  species: z.enum(['cattle', 'buffalo', 'goat', 'sheep', 'other']),
  breed: z.string().max(64).optional(),
  sex: z.enum(['male', 'female']),
  dob: dateIsoSchema.optional(),
  damEarTag: z.string().max(32).optional(),
  sireEarTag: z.string().max(32).optional(),
  acquisitionDate: dateIsoSchema.optional(),
  acquisitionPricePkr: pkrAmountSchema.optional(),
  photoUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});
export type AnimalCreateInput = z.infer<typeof animalCreateSchema>;

export const breedingEventSchema = z.object({
  animalId: uuidSchema,
  eventType: z.enum(['heat', 'breeding', 'pregnancy', 'calving', 'abortion']),
  eventDate: dateIsoSchema,
  details: z.record(z.unknown()).optional(),
});
export type BreedingEventInput = z.infer<typeof breedingEventSchema>;

export const milkRecordSchema = z.object({
  animalId: uuidSchema,
  recordedOn: dateIsoSchema,
  session: z.enum(['morning', 'evening']),
  litres: z.coerce.number().positive(),
  fatPct: z.coerce.number().min(0).max(15).optional(),
  snfPct: z.coerce.number().min(0).max(15).optional(),
});
export type MilkRecordInput = z.infer<typeof milkRecordSchema>;

export const milkBulkSchema = z.object({
  recordedOn: dateIsoSchema,
  session: z.enum(['morning', 'evening']),
  rows: z.array(milkRecordSchema.omit({ recordedOn: true, session: true })).min(1),
});
export type MilkBulkInput = z.infer<typeof milkBulkSchema>;

export const healthEventSchema = z.object({
  entityId: uuidSchema,
  animalId: uuidSchema,
  eventType: z.enum(['vaccination', 'treatment', 'deworming', 'check_up', 'injury']),
  eventDate: dateIsoSchema,
  diagnosis: z.string().max(1000).optional(),
  treatment: z.string().max(2000).optional(),
  medicineCostPkr: pkrAmountSchema.optional(),
  vetCostPkr: pkrAmountSchema.optional(),
  withdrawalUntil: dateIsoSchema.optional(),
  notes: z.string().max(2000).optional(),
});
export type HealthEventInput = z.infer<typeof healthEventSchema>;

export const feedRecordSchema = z.object({
  entityId: uuidSchema,
  animalId: uuidSchema.optional(),
  groupKey: z.string().max(32).optional(),
  recordedOn: dateIsoSchema,
  feedMix: z
    .array(
      z.object({
        feedName: z.string().min(1).max(64),
        kg: z.coerce.number().positive(),
        costPkr: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
});
export type FeedRecordInput = z.infer<typeof feedRecordSchema>;

export const livestockSaleSchema = z.object({
  entityId: uuidSchema,
  animalId: uuidSchema,
  saleDate: dateIsoSchema,
  salePricePkr: pkrAmountSchema,
  buyer: z.string().min(1).max(256),
  reason: z.enum(['eid', 'breeding', 'cull', 'other']),
  notes: z.string().max(2000).optional(),
});
export type LivestockSaleInput = z.infer<typeof livestockSaleSchema>;
