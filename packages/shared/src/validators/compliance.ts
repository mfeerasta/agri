import { z } from 'zod';
import { dateIsoSchema, pkrAmountSchema, uuidSchema } from './common.js';

export const documentCreateSchema = z.object({
  entityId: uuidSchema,
  documentType: z.enum([
    'fard',
    'mutation',
    'lease_deed',
    'tubewell_license',
    'warabandi_schedule',
    'tax_filing',
    'subsidy',
    'cnic',
    'ntn',
    'bank_statement',
    'invoice',
    'other',
  ]),
  title: z.string().min(1).max(512),
  fileUrl: z.string().url(),
  mimeType: z.string().max(64).optional(),
  issuedOn: dateIsoSchema.optional(),
  expiresOn: dateIsoSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

export const taxFilingSchema = z.object({
  entityId: uuidSchema,
  taxKind: z.enum(['income_tax', 'sales_tax', 'land_revenue', 'professional_tax', 'other']),
  periodLabel: z.string().min(1).max(32),
  amountPkr: pkrAmountSchema,
  filedOn: dateIsoSchema.optional(),
  challanNumber: z.string().max(64).optional(),
  challanPhotoUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});
export type TaxFilingInput = z.infer<typeof taxFilingSchema>;

export const subsidyCreateSchema = z.object({
  entityId: uuidSchema,
  programName: z.string().min(1).max(64),
  applicationDate: dateIsoSchema,
  amountPkr: pkrAmountSchema.optional(),
  notes: z.string().max(2000).optional(),
});
export type SubsidyCreateInput = z.infer<typeof subsidyCreateSchema>;

export const sprayDiarySchema = z.object({
  entityId: uuidSchema,
  fieldId: uuidSchema,
  cropPlanId: uuidSchema.optional(),
  sprayedOn: dateIsoSchema,
  pesticideName: z.string().min(1).max(256),
  activeIngredient: z.string().max(256).optional(),
  doseLitresPerAcre: z.coerce.number().nonnegative().optional(),
  totalLitresUsed: z.coerce.number().nonnegative().optional(),
  applicator: z.string().max(256).optional(),
  weatherConditions: z.record(z.unknown()).optional(),
  preHarvestIntervalDays: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});
export type SprayDiaryInput = z.infer<typeof sprayDiarySchema>;
