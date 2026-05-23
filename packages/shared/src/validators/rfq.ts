import { z } from 'zod';
import { dateIsoSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const rfqLineItemSchema = z.object({
  description: z.string().min(1).max(512),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(32),
  specifications: z.record(z.string(), z.unknown()).optional(),
});

export const rfqCreateSchema = z.object({
  entityId: uuidSchema,
  title: z.string().min(3).max(256),
  description: z.string().max(4000).optional(),
  category: z.string().min(1).max(64),
  neededBy: dateIsoSchema.optional(),
  fieldId: uuidSchema.optional(),
  cropPlanId: uuidSchema.optional(),
  budgetEstimatePkr: z.coerce.number().nonnegative().optional(),
  lineItems: z.array(rfqLineItemSchema).min(1),
  invitedVendorIds: z.array(uuidSchema).min(1).max(50),
});
export type RfqCreateInput = z.infer<typeof rfqCreateSchema>;

export const rfqQuoteLinePriceSchema = z.object({
  lineItemId: uuidSchema,
  unitPricePkr: z.coerce.number().nonnegative(),
  notes: z.string().max(512).optional(),
});

export const rfqQuoteSubmitSchema = z.object({
  rfqId: uuidSchema,
  vendorId: uuidSchema,
  totalPkr: pkrAmountSchema,
  paymentTerms: z.string().max(256).optional(),
  deliveryLeadDays: z.coerce.number().int().nonnegative().optional(),
  validityDays: z.coerce.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  quoteDocUrl: z.string().url().optional(),
  linePrices: z.array(rfqQuoteLinePriceSchema).default([]),
});
export type RfqQuoteSubmitInput = z.infer<typeof rfqQuoteSubmitSchema>;

export const rfqSelectWinnerSchema = z.object({
  rfqId: uuidSchema,
  quoteId: uuidSchema,
  selectionReason: z
    .enum(['cheapest', 'fastest', 'best_terms', 'best_quality', 'only_available', 'other'])
    .or(z.string().min(3).max(512)),
  reasonNote: z.string().max(2000).optional(),
});
export type RfqSelectWinnerInput = z.infer<typeof rfqSelectWinnerSchema>;

export const rfqSendInvitationsSchema = z.object({
  rfqId: uuidSchema,
});
export type RfqSendInvitationsInput = z.infer<typeof rfqSendInvitationsSchema>;

export const rfqInboundQuoteSchema = z.object({
  replyToken: z.string().min(8).max(128),
  totalPkr: pkrAmountSchema,
  paymentTerms: z.string().max(256).optional(),
  deliveryLeadDays: z.coerce.number().int().nonnegative().optional(),
  validityDays: z.coerce.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  quoteDocUrl: z.string().url().optional(),
  linePrices: z.array(rfqQuoteLinePriceSchema).default([]),
});
export type RfqInboundQuoteInput = z.infer<typeof rfqInboundQuoteSchema>;
