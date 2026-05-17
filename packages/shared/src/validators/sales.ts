import { z } from 'zod';
import { dateIsoSchema, photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const buyerCreateSchema = z.object({
  entityId: uuidSchema,
  code: z.string().min(1).max(24),
  name: z.string().min(1).max(256),
  category: z.enum(['mandi', 'mill', 'private', 'milk', 'export']),
  phone: z.string().max(24).optional(),
  address: z.string().max(1024).optional(),
});
export type BuyerCreateInput = z.infer<typeof buyerCreateSchema>;

export const arhtiCreateSchema = z.object({
  entityId: uuidSchema,
  name: z.string().min(1).max(256),
  mandiLocation: z.string().max(256).optional(),
  commissionPct: z.coerce.number().min(0).max(20).optional(),
  phone: z.string().max(24).optional(),
});
export type ArhtiCreateInput = z.infer<typeof arhtiCreateSchema>;

export const mandiDispatchSchema = z.object({
  entityId: uuidSchema,
  produceLotId: uuidSchema.optional(),
  arhtiId: uuidSchema,
  dispatchedOn: dateIsoSchema,
  vehicleNumber: z.string().max(24).optional(),
  driverName: z.string().max(256).optional(),
  netWeightKg: z.coerce.number().positive(),
  bagsCount: z.coerce.number().int().nonnegative().optional(),
  freightPkr: pkrAmountSchema.optional(),
  estimatedValuePkr: pkrAmountSchema.optional(),
});
export type MandiDispatchInput = z.infer<typeof mandiDispatchSchema>;

export const mandiSettlementSchema = z
  .object({
    mandiDispatchId: uuidSchema,
    settledOn: dateIsoSchema,
    grossPricePkr: z.coerce.number().nonnegative(),
    commissionPkr: z.coerce.number().nonnegative(),
    loadingPkr: z.coerce.number().nonnegative().default(0),
    weighingPkr: z.coerce.number().nonnegative().default(0),
    otherDeductionsPkr: z.coerce.number().nonnegative().default(0),
    pattiPhotoUrl: z.string().url().optional(),
  })
  .transform((v) => {
    const netReceivedPkr = Number(
      (v.grossPricePkr - v.commissionPkr - v.loadingPkr - v.weighingPkr - v.otherDeductionsPkr).toFixed(2),
    );
    return { ...v, netReceivedPkr };
  });
export type MandiSettlementInput = z.infer<typeof mandiSettlementSchema>;

export const milkDispatchSchema = z.object({
  entityId: uuidSchema,
  buyerId: uuidSchema,
  dispatchedOn: dateIsoSchema,
  session: z.enum(['morning', 'evening']),
  litres: z.coerce.number().positive(),
  fatPct: z.coerce.number().min(0).max(15).optional(),
  snfPct: z.coerce.number().min(0).max(15).optional(),
  ratePerLitrePkr: z.coerce.number().nonnegative(),
});
export type MilkDispatchInput = z.infer<typeof milkDispatchSchema>;

export const milkSettlementSchema = z.object({
  entityId: uuidSchema,
  buyerId: uuidSchema,
  periodStart: dateIsoSchema,
  periodEnd: dateIsoSchema,
  totalLitres: z.coerce.number().positive(),
  agreedAmountPkr: pkrAmountSchema,
  deductionsPkr: pkrAmountSchema.default('0'),
  netReceivedPkr: pkrAmountSchema,
  statementPhotoUrls: photoUrlsSchema,
});
export type MilkSettlementInput = z.infer<typeof milkSettlementSchema>;
