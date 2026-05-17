import { z } from 'zod';
import { photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const repairRequestSchema = z.object({
  entityId: uuidSchema,
  assetId: uuidSchema,
  reportedBy: uuidSchema.optional(),
  issueDescription: z.string().min(5).max(4000),
  issueDescriptionUr: z.string().max(4000).optional(),
  severity: z.enum(['operational', 'minor', 'major', 'breakdown']),
  suggestedAction: z.string().max(2000).optional(),
  problemPhotoUrls: photoUrlsSchema.refine((a) => a.length >= 1, 'At least one problem photo required'),
});
export type RepairRequestInput = z.infer<typeof repairRequestSchema>;

export const repairQuoteLineSchema = z.object({
  name: z.string().min(1).max(256),
  qty: z.coerce.number().positive(),
  unitPricePkr: z.coerce.number().nonnegative(),
});

export const repairQuoteSchema = z
  .object({
    repairRequestId: uuidSchema,
    workshopName: z.string().min(1).max(256),
    workshopContact: z.string().max(64).optional(),
    workshopLocation: z.string().max(512).optional(),
    partsList: z.array(repairQuoteLineSchema).default([]),
    laborTotalPkr: pkrAmountSchema,
    etaDays: z.coerce.number().nonnegative().optional(),
    warrantyDays: z.coerce.number().nonnegative().optional(),
    quoteDocumentUrls: photoUrlsSchema,
  })
  .transform((v) => {
    const partsTotalPkr = v.partsList.reduce((sum, p) => sum + p.qty * p.unitPricePkr, 0);
    const totalQuotePkr = Number((partsTotalPkr + Number(v.laborTotalPkr)).toFixed(2));
    return { ...v, partsTotalPkr: Number(partsTotalPkr.toFixed(2)), totalQuotePkr };
  });
export type RepairQuoteInput = z.infer<typeof repairQuoteSchema>;

export const repairQuoteSelectionSchema = z.object({
  repairRequestId: uuidSchema,
  selectedQuoteId: uuidSchema,
  selectionReason: z.enum(['cheapest', 'fastest', 'best_warranty', 'only_available', 'other']),
  selectionReasonText: z.string().max(2000).optional(),
});

export const repairWorkOrderClosureSchema = z.object({
  workOrderId: uuidSchema,
  actualCompletionAt: z.string().datetime({ offset: true }),
  finalInvoicePkr: z.coerce.number().nonnegative(),
  finalInvoicePhotoUrls: photoUrlsSchema.refine((a) => a.length >= 1, 'Final invoice photo required'),
  operatorSignoffBy: uuidSchema,
  operatorSignoffPhotoUrl: z.string().url().optional(),
  warrantyDays: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(4000).optional(),
});
