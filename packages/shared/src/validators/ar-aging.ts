import { z } from 'zod';
import { dateIsoSchema, pkrAmountSchema, photoUrlsSchema, uuidSchema } from './common.js';

export const arInvoiceCreateSchema = z.object({
  entityId: uuidSchema,
  buyerId: uuidSchema,
  invoiceNumber: z.string().min(1).max(64),
  invoiceDate: dateIsoSchema,
  dueDate: dateIsoSchema,
  salesDispatchId: uuidSchema.optional(),
  deliveryId: uuidSchema.optional(),
  forwardContractId: uuidSchema.optional(),
  description: z.string().max(2000).optional(),
  amountPkr: pkrAmountSchema,
  taxPkr: pkrAmountSchema.optional(),
  discountPkr: pkrAmountSchema.optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  invoicePdfUrl: z.string().url().optional(),
});

export const arReceiptCreateSchema = z.object({
  invoiceId: uuidSchema,
  receivedOn: dateIsoSchema,
  amountPkr: pkrAmountSchema,
  method: z.enum(['cash', 'cheque', 'bank_transfer', 'online', 'adjustment', 'barter']),
  referenceNumber: z.string().max(64).optional(),
  bankName: z.string().max(120).optional(),
  clearedOn: dateIsoSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const buyerCreditLimitUpsertSchema = z.object({
  entityId: uuidSchema,
  buyerId: uuidSchema,
  creditLimitPkr: pkrAmountSchema,
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  earlyPaymentDiscountPct: z.number().min(0).max(50).optional(),
  lateFeePctPerMonth: z.number().min(0).max(20).optional(),
  effectiveFrom: dateIsoSchema,
  effectiveTo: dateIsoSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const arDisputeCreateSchema = z.object({
  invoiceId: uuidSchema,
  raisedOn: dateIsoSchema,
  raisedByBuyer: z.string().max(160).optional(),
  disputeKind: z.enum([
    'quantity_short',
    'quality_issue',
    'wrong_amount',
    'duplicate_billing',
    'already_paid',
    'contract_breach',
    'other',
  ]),
  disputedAmountPkr: pkrAmountSchema.optional(),
  description: z.string().min(1).max(4000),
  evidenceUrls: photoUrlsSchema,
});

export const arDisputeResolveSchema = z.object({
  disputeId: uuidSchema,
  status: z.enum(['resolved', 'escalated_to_legal', 'withdrawn', 'written_off']),
  resolution: z.string().min(1).max(4000),
  resolutionAmountPkr: pkrAmountSchema.optional(),
  resolvedOn: dateIsoSchema,
});

export type ArInvoiceCreate = z.infer<typeof arInvoiceCreateSchema>;
export type ArReceiptCreate = z.infer<typeof arReceiptCreateSchema>;
export type BuyerCreditLimitUpsert = z.infer<typeof buyerCreditLimitUpsertSchema>;
export type ArDisputeCreate = z.infer<typeof arDisputeCreateSchema>;
export type ArDisputeResolve = z.infer<typeof arDisputeResolveSchema>;
