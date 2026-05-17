import { z } from 'zod';

export const dieselReceiptExtractSchema = z.object({
  vendorName: z.string().min(1).max(256).optional().nullable(),
  vendorLocation: z.string().max(512).optional().nullable(),
  purchasedAt: z.string().optional().nullable(),
  quantityLiters: z.coerce.number().nonnegative().optional().nullable(),
  rateLiterPkr: z.coerce.number().nonnegative().optional().nullable(),
  totalPkr: z.coerce.number().nonnegative().optional().nullable(),
  paymentMethod: z.enum(['cash', 'credit', 'card', 'fuel_card']).optional().nullable(),
  receiptNumber: z.string().max(128).optional().nullable(),
  confidence: z.coerce.number().min(0).max(1),
  rawText: z.string().default(''),
});
export type DieselReceiptExtract = z.infer<typeof dieselReceiptExtractSchema>;

export const repairQuoteLineExtractSchema = z.object({
  name: z.string().min(1).max(256),
  qty: z.coerce.number().positive(),
  unitPricePkr: z.coerce.number().nonnegative(),
});

export const repairQuoteExtractSchema = z.object({
  workshopName: z.string().min(1).max(256).optional().nullable(),
  workshopContact: z.string().max(128).optional().nullable(),
  partsList: z.array(repairQuoteLineExtractSchema).optional().nullable(),
  laborTotalPkr: z.coerce.number().nonnegative().optional().nullable(),
  totalQuotePkr: z.coerce.number().nonnegative().optional().nullable(),
  etaDays: z.coerce.number().nonnegative().optional().nullable(),
  warrantyDays: z.coerce.number().nonnegative().optional().nullable(),
  confidence: z.coerce.number().min(0).max(1),
  rawText: z.string().default(''),
});
export type RepairQuoteExtract = z.infer<typeof repairQuoteExtractSchema>;

export const ocrTriggerPayloadSchema = z.object({
  table: z.enum(['diesel_purchases', 'repair_quotes']),
  recordId: z.string().uuid(),
});
export type OcrTriggerPayload = z.infer<typeof ocrTriggerPayloadSchema>;
