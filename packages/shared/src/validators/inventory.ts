import { z } from 'zod';
import { photoUrlsSchema, pkrAmountSchema, timestampIsoSchema, uuidSchema } from './common.js';

export const inputCreateSchema = z.object({
  entityId: uuidSchema,
  type: z.enum(['seed', 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'fuel', 'packaging', 'other']),
  name: z.string().min(1).max(256),
  nameUr: z.string().max(256).optional(),
  brand: z.string().max(256).optional(),
  unit: z.string().min(1).max(16),
  unitSizeKg: z.coerce.number().nonnegative().optional(),
  expiryTracked: z.boolean().default(false),
  reorderPoint: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});
export type InputCreateInput = z.infer<typeof inputCreateSchema>;

export const inputPurchaseSchema = z
  .object({
    entityId: uuidSchema,
    inputId: uuidSchema,
    vendorId: uuidSchema.optional(),
    purchasedOn: timestampIsoSchema,
    quantity: z.coerce.number().positive(),
    unitPricePkr: z.coerce.number().positive(),
    totalPkr: pkrAmountSchema,
    invoiceNumber: z.string().max(64).optional(),
    receiptPhotoUrls: photoUrlsSchema.refine((a) => a.length >= 1, 'At least one receipt photo required'),
    expiryDate: timestampIsoSchema.optional(),
    batchNumber: z.string().max(64).optional(),
    notes: z.string().max(2000).optional(),
  });
export type InputPurchaseInput = z.infer<typeof inputPurchaseSchema>;

export const inputIssuanceSchema = z.object({
  entityId: uuidSchema,
  inputId: uuidSchema,
  fieldId: uuidSchema,
  cropPlanId: uuidSchema.optional(),
  issuedOn: timestampIsoSchema,
  quantity: z.coerce.number().positive(),
  unitCostPkr: z.coerce.number().nonnegative(),
  totalCostPkr: z.coerce.number().nonnegative(),
  receivedBy: uuidSchema.optional(),
  purpose: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});
export type InputIssuanceInput = z.infer<typeof inputIssuanceSchema>;

export const produceMovementSchema = z.object({
  produceLotId: uuidSchema,
  fromLocationId: uuidSchema.optional(),
  toLocationId: uuidSchema,
  quantityKg: z.coerce.number().positive(),
  reason: z.string().max(2000).optional(),
});
export type ProduceMovementInput = z.infer<typeof produceMovementSchema>;

export const storageLocationCreateSchema = z.object({
  entityId: uuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(256),
  kind: z.string().min(1).max(32),
  capacityKg: z.coerce.number().nonnegative().optional(),
});
export type StorageLocationCreateInput = z.infer<typeof storageLocationCreateSchema>;

export const assetCreateSchema = z.object({
  entityId: uuidSchema,
  code: z.string().min(1).max(32),
  category: z.enum(['tractor', 'harvester', 'thresher', 'sprayer', 'tubewell', 'generator', 'implement', 'vehicle', 'building', 'other']),
  make: z.string().max(256).optional(),
  model: z.string().max(256).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  registrationNumber: z.string().max(32).optional(),
  engineNumber: z.string().max(64).optional(),
  chassisNumber: z.string().max(64).optional(),
  purchaseDate: timestampIsoSchema.optional(),
  purchasePricePkr: pkrAmountSchema,
  usefulLifeYears: z.coerce.number().int().positive().optional(),
  manufacturerFuelSpecLph: z.coerce.number().positive().optional(),
  currentHourMeter: z.coerce.number().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;

export const assetHourMeterSchema = z.object({
  assetId: uuidSchema,
  recordedOn: timestampIsoSchema,
  meterReading: z.coerce.number().nonnegative(),
  source: z.string().max(32).default('manual'),
});
export type AssetHourMeterInput = z.infer<typeof assetHourMeterSchema>;
