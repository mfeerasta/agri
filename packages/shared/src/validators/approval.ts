import { z } from 'zod';
import { gpsPointSchema, pkrAmountSchema, uuidSchema } from './common.js';
import { APPROVAL_TYPES } from '../constants.js';

export const approvalTypeSchema = z.enum(APPROVAL_TYPES);

export const submitApprovalSchema = z.object({
  entityId: uuidSchema,
  approvalType: approvalTypeSchema,
  sourceModule: z.string().min(1).max(32),
  sourceRecordId: uuidSchema.optional(),
  title: z.string().min(3).max(512),
  titleUr: z.string().max(512).optional(),
  amountPkr: pkrAmountSchema.optional(),
  payload: z.record(z.unknown()),
  contextSnapshot: z.record(z.unknown()).optional(),
});
export type SubmitApprovalInput = z.infer<typeof submitApprovalSchema>;

export const approvalDecisionSchema = z.object({
  approvalRequestId: uuidSchema,
  action: z.enum(['approve', 'reject', 'send_back', 'escalate']),
  comment: z.string().max(4000).optional(),
  commentUr: z.string().max(4000).optional(),
  gpsLocation: gpsPointSchema.optional(),
});
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export const delegationSchema = z
  .object({
    userId: uuidSchema,
    entityId: uuidSchema,
    delegateUserId: uuidSchema,
    delegationStart: z.string().datetime({ offset: true }),
    delegationEnd: z.string().datetime({ offset: true }),
  })
  .refine(
    (v) => new Date(v.delegationEnd) > new Date(v.delegationStart),
    'delegationEnd must be after delegationStart',
  );

export const emergencyExecuteSchema = z.object({
  approvalRequestId: uuidSchema,
  justification: z.string().min(20).max(4000),
});

export const feasibilityStudySchema = z.object({
  entityId: uuidSchema,
  title: z.string().min(5).max(512),
  titleUr: z.string().max(512).optional(),
  background: z.string().min(20).max(20_000),
  scope: z.object({
    fieldIds: z.array(uuidSchema).optional(),
    acres: z.coerce.number().nonnegative().optional(),
    durationMonths: z.coerce.number().nonnegative().optional(),
    description: z.string().max(4000).optional(),
  }),
  capexEstimatePkr: pkrAmountSchema,
  opexEstimatePkr: pkrAmountSchema,
  costBreakdown: z.array(
    z.object({ heading: z.string(), amountPkr: pkrAmountSchema, notes: z.string().optional() }),
  ),
  revenueProjection: z.object({
    yieldAssumption: z.string().optional(),
    pricePerUnitPkr: pkrAmountSchema.optional(),
    grossPkr: pkrAmountSchema,
    netPkr: pkrAmountSchema,
  }),
  sensitivity: z
    .object({
      downsidePkr: pkrAmountSchema.optional(),
      basePkr: pkrAmountSchema.optional(),
      upsidePkr: pkrAmountSchema.optional(),
    })
    .optional(),
  riskAssessment: z.array(
    z.object({
      category: z.enum(['weather', 'market', 'operational', 'regulatory', 'financial', 'other']),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string().min(5).max(2000),
      mitigation: z.string().max(2000).optional(),
    }),
  ),
  statusQuoComparison: z.string().max(8000).optional(),
});
export type FeasibilityStudyInput = z.infer<typeof feasibilityStudySchema>;
