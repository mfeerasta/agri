import { z } from 'zod';

export const buyerTypeEnum = z.enum([
  'mandi_arhti',
  'flour_mill',
  'rice_mill',
  'sugar_mill',
  'exporter',
  'wholesale',
  'retail',
  'government',
  'other',
]);

export const buyerCrmCreateSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1),
  nameUr: z.string().optional(),
  buyerType: buyerTypeEnum,
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  cnic: z.string().optional(),
  ntn: z.string().optional(),
  address: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  creditLimitPkr: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'dormant', 'blacklisted']).default('active'),
  blacklistedReason: z.string().optional(),
});

export const salesOpportunitySchema = z.object({
  entityId: z.string().uuid(),
  buyerId: z.string().uuid().optional(),
  buyerNameFreeform: z.string().optional(),
  cropCode: z.string().min(1),
  estimatedKg: z.number().positive(),
  targetPricePerKgPkr: z.number().positive().optional(),
  stage: z.enum(['lead', 'qualified', 'negotiating', 'contracted', 'delivered', 'lost']).default('lead'),
  expectedCloseDate: z.string().optional(),
  winProbabilityPct: z.number().int().min(0).max(100).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const opportunityStageUpdateSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(['lead', 'qualified', 'negotiating', 'contracted', 'delivered', 'lost']),
  lostReason: z.string().optional(),
});

export const forwardContractCreateSchema = z.object({
  entityId: z.string().uuid(),
  buyerId: z.string().uuid(),
  contractNumber: z.string().min(1),
  signedOn: z.string(),
  cropCode: z.string().min(1),
  committedKg: z.number().positive(),
  agreedPricePerKgPkr: z.number().positive(),
  deliveryWindowStart: z.string(),
  deliveryWindowEnd: z.string(),
  deliveryPoint: z.string().optional(),
  paymentTerms: z.string().optional(),
  advanceReceivedPkr: z.number().nonnegative().default(0),
  advanceReceivedOn: z.string().optional(),
  qualitySpecs: z.record(z.string(), z.unknown()).optional(),
  penaltyClause: z.string().optional(),
  contractDocUrl: z.string().url().optional(),
});

export const contractDeliverySchema = z.object({
  contractId: z.string().uuid(),
  deliveredOn: z.string(),
  kg: z.number().positive(),
  pkr: z.number().positive(),
  produceLotIds: z.array(z.string().uuid()).default([]),
  deliveryNoteUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export type BuyerCrmCreate = z.infer<typeof buyerCrmCreateSchema>;
export type SalesOpportunity = z.infer<typeof salesOpportunitySchema>;
export type ForwardContractCreate = z.infer<typeof forwardContractCreateSchema>;
export type ContractDelivery = z.infer<typeof contractDeliverySchema>;
