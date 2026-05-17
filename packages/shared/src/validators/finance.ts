import { z } from 'zod';
import { dateIsoSchema, photoUrlsSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const bankReconRowSchema = z.object({
  postedOn: dateIsoSchema,
  description: z.string().max(512),
  debitPkr: z.coerce.number().nonnegative().default(0),
  creditPkr: z.coerce.number().nonnegative().default(0),
  reference: z.string().max(128).optional(),
});

export const bankReconUploadSchema = z.object({
  entityId: uuidSchema,
  accountCode: z.string().min(1).max(16),
  statementDate: dateIsoSchema,
  rows: z.array(bankReconRowSchema).min(1),
  statementPhotoUrls: photoUrlsSchema.optional(),
});
export type BankReconUploadInput = z.infer<typeof bankReconUploadSchema>;

export const cashFlowRefreshSchema = z.object({
  entityId: uuidSchema,
  horizonDays: z.coerce.number().int().min(7).max(180).default(90),
});
export type CashFlowRefreshInput = z.infer<typeof cashFlowRefreshSchema>;
