import { z } from 'zod';
import { dateIsoSchema, photoUrlsSchema, pkrAmountSchema, timestampIsoSchema, uuidSchema } from './common.js';

export const dieselPurchaseSchema = z
  .object({
    entityId: uuidSchema,
    purchasedAt: timestampIsoSchema,
    vendorName: z.string().min(1).max(256),
    vendorLocation: z.string().max(512).optional(),
    quantityLiters: z.coerce.number().positive(),
    rateLiterPkr: z.coerce.number().positive(),
    totalPkr: pkrAmountSchema,
    paymentMethod: z.enum(['cash', 'credit', 'bank_transfer', 'card', 'fuel_card', 'cheque']),
    filledToTankId: uuidSchema.optional(),
    filledDirectlyToAssetId: uuidSchema.optional(),
    receiptPhotoUrls: photoUrlsSchema.refine((arr) => arr.length >= 1, 'At least one receipt photo required'),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (v) => !!v.filledToTankId !== !!v.filledDirectlyToAssetId,
    'Either filledToTankId or filledDirectlyToAssetId, not both',
  );

export type DieselPurchaseInput = z.infer<typeof dieselPurchaseSchema>;

export const dieselDailyLogSchema = z
  .object({
    entityId: uuidSchema,
    assetId: uuidSchema,
    logDate: dateIsoSchema,
    operatorId: uuidSchema.optional(),
    operatorName: z.string().min(1).max(256),
    hourMeterStart: z.coerce.number().nonnegative(),
    hourMeterEnd: z.coerce.number().nonnegative(),
    dieselFilledLiters: z.coerce.number().positive(),
    rateLiterPkr: z.coerce.number().positive(),
    sourceTankId: uuidSchema.optional(),
    taskFieldId: uuidSchema.optional(),
    taskKind: z.string().max(32).optional(),
    taskNotes: z.string().max(2000).optional(),
    receiptPhotoUrls: photoUrlsSchema,
    idleHours: z.coerce.number().nonnegative().optional(),
    breakdownHours: z.coerce.number().nonnegative().optional(),
  })
  .refine((v) => v.hourMeterEnd >= v.hourMeterStart, 'hourMeterEnd must be >= hourMeterStart')
  .transform((v) => ({
    ...v,
    hoursRun: Number((v.hourMeterEnd - v.hourMeterStart).toFixed(2)),
    totalCostPkr: Number((v.dieselFilledLiters * v.rateLiterPkr).toFixed(2)),
  }));

export type DieselDailyLogInput = z.infer<typeof dieselDailyLogSchema>;

export const dieselStockReconciliationSchema = z
  .object({
    tankId: uuidSchema,
    reconciledOn: dateIsoSchema,
    openingStockLiters: z.coerce.number().nonnegative(),
    purchasesInLiters: z.coerce.number().nonnegative(),
    issuancesOutLiters: z.coerce.number().nonnegative(),
    actualClosingLiters: z.coerce.number().nonnegative(),
    physicalCheckPhotoUrls: photoUrlsSchema,
    notes: z.string().max(2000).optional(),
  })
  .transform((v) => {
    const expectedClosingLiters = Number(
      (v.openingStockLiters + v.purchasesInLiters - v.issuancesOutLiters).toFixed(2),
    );
    const varianceLiters = Number((v.actualClosingLiters - expectedClosingLiters).toFixed(2));
    const variancePct =
      expectedClosingLiters === 0 ? 0 : Number(((varianceLiters / expectedClosingLiters) * 100).toFixed(3));
    return { ...v, expectedClosingLiters, varianceLiters, variancePct };
  });

export type DieselStockReconciliationInput = z.infer<typeof dieselStockReconciliationSchema>;
