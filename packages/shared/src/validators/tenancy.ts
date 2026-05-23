import { z } from 'zod';
import { dateIsoSchema, uuidSchema, phonePkSchema } from './common.js';

export const leaseTenureSchema = z.enum([
  'owned',
  'rented_in',
  'rented_out',
  'sharecrop_in',
  'sharecrop_out',
  'musharka',
  'other',
]);

export const rentScheduleSchema = z.enum(['annual', 'semi_annual', 'quarterly', 'monthly', 'seasonal']);
export const leaseStatusSchema = z.enum(['active', 'expired', 'terminated', 'disputed']);

// Pakistan CNIC: 13 digits, optionally with dashes (xxxxx-xxxxxxx-x)
const cnicSchema = z
  .string()
  .regex(/^\d{5}-?\d{7}-?\d$/, 'CNIC must be 13 digits (xxxxx-xxxxxxx-x)')
  .optional()
  .or(z.literal(''));

export const leaseContractCreateSchema = z
  .object({
    entityId: uuidSchema,
    fieldId: uuidSchema,
    counterpartyName: z.string().min(2),
    counterpartyCnic: cnicSchema,
    counterpartyPhone: phonePkSchema.optional().or(z.literal('')),
    tenure: leaseTenureSchema,
    startDate: dateIsoSchema,
    endDate: dateIsoSchema.optional().or(z.literal('')),
    annualRentPkr: z.number().nonnegative().optional(),
    rentPaymentSchedule: rentScheduleSchema.optional(),
    sharePctLandowner: z.number().min(0).max(100).optional(),
    sharePctTenant: z.number().min(0).max(100).optional(),
    inputShareArrangement: z
      .object({
        seedsPctLandowner: z.number().min(0).max(100).optional(),
        fertilizerPctLandowner: z.number().min(0).max(100).optional(),
        pesticidePctLandowner: z.number().min(0).max(100).optional(),
        irrigationPctLandowner: z.number().min(0).max(100).optional(),
        laborPctLandowner: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
      })
      .optional(),
    deedDocUrl: z.string().url().optional().or(z.literal('')),
    status: leaseStatusSchema.default('active'),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const isRented = v.tenure === 'rented_in' || v.tenure === 'rented_out';
    const isShare = v.tenure === 'sharecrop_in' || v.tenure === 'sharecrop_out' || v.tenure === 'musharka';
    if (isRented) {
      if (v.annualRentPkr == null || v.annualRentPkr <= 0) {
        ctx.addIssue({ code: 'custom', path: ['annualRentPkr'], message: 'Annual rent is required for rented tenure' });
      }
      if (!v.rentPaymentSchedule) {
        ctx.addIssue({ code: 'custom', path: ['rentPaymentSchedule'], message: 'Payment schedule is required for rented tenure' });
      }
    }
    if (isShare) {
      if (v.sharePctLandowner == null || v.sharePctTenant == null) {
        ctx.addIssue({ code: 'custom', path: ['sharePctLandowner'], message: 'Share percentages are required for sharecrop' });
      } else if (Math.abs(Number(v.sharePctLandowner) + Number(v.sharePctTenant) - 100) > 0.01) {
        ctx.addIssue({ code: 'custom', path: ['sharePctTenant'], message: 'Landowner + tenant share must sum to 100%' });
      }
    }
  });
export type LeaseContractCreateInput = z.infer<typeof leaseContractCreateSchema>;

export const leasePaymentSchema = z.object({
  leaseId: uuidSchema,
  paidOn: dateIsoSchema,
  amountPkr: z.number().positive(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'mobile_wallet', 'in_kind']),
  referenceNumber: z.string().optional(),
  receiptUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});
export type LeasePaymentInput = z.infer<typeof leasePaymentSchema>;

export const sharecropSettlementSchema = z.object({
  leaseId: uuidSchema,
  harvestRecordId: uuidSchema.optional(),
  cropPlanId: uuidSchema.optional(),
  settledOn: dateIsoSchema,
  grossProduceKg: z.number().nonnegative(),
  grossRevenuePkr: z.number().nonnegative(),
  deductionsPkr: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});
export type SharecropSettlementInput = z.infer<typeof sharecropSettlementSchema>;
