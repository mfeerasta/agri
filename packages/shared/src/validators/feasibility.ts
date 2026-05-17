import { z } from 'zod';
import { uuidSchema } from './common.js';

export const feasibilityDraftRequestSchema = z.object({
  title: z.string().min(3).max(256),
  type: z.string().min(2).max(64),
  briefDescription: z.string().min(20).max(4000),
  fieldIds: z.array(uuidSchema).optional(),
  capexEstimatePkr: z.coerce.number().nonnegative().optional(),
  opexEstimatePkr: z.coerce.number().nonnegative().optional(),
});
export type FeasibilityDraftRequestInput = z.infer<typeof feasibilityDraftRequestSchema>;

const riskItemSchema = z.object({
  risk: z.string().min(1),
  likelihood: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  mitigation: z.string().min(1),
});

export const feasibilityStudySchema = z.object({
  entityId: uuidSchema,
  title: z.string().min(3).max(256),
  titleUr: z.string().max(256).optional(),
  background: z.string().min(20),
  scope: z.object({
    objectives: z.array(z.string()).min(1),
    deliverables: z.array(z.string()).min(1),
    timelineMonths: z.coerce.number().int().positive(),
    boundaries: z.string().min(1),
  }),
  capexEstimatePkr: z.coerce.number().nonnegative(),
  opexEstimatePkr: z.coerce.number().nonnegative(),
  costBreakdown: z.array(
    z.object({
      category: z.string(),
      subcategory: z.string().optional(),
      amountPkr: z.coerce.number(),
      notes: z.string().optional(),
    }),
  ),
  revenueProjection: z.object({
    yearOnePkr: z.coerce.number(),
    yearTwoPkr: z.coerce.number(),
    yearThreePkr: z.coerce.number(),
    assumptions: z.array(z.string()),
  }),
  yieldAssumptions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  priceAssumptions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  sensitivity: z
    .object({
      yieldMinus20: z.object({ netPkr: z.coerce.number(), note: z.string() }),
      priceMinus15: z.object({ netPkr: z.coerce.number(), note: z.string() }),
      inputPlus10: z.object({ netPkr: z.coerce.number(), note: z.string() }),
      baseline: z.object({ netPkr: z.coerce.number(), note: z.string() }),
    })
    .optional(),
  riskAssessment: z.object({
    operational: z.array(riskItemSchema),
    market: z.array(riskItemSchema),
    financial: z.array(riskItemSchema),
    regulatory: z.array(riskItemSchema),
  }),
  statusQuoComparison: z
    .object({
      currentNetPkr: z.coerce.number(),
      proposedNetPkr: z.coerce.number(),
      deltaPkr: z.coerce.number(),
      paybackMonths: z.coerce.number(),
      note: z.string(),
    })
    .optional(),
});
export type FeasibilityStudyInput = z.infer<typeof feasibilityStudySchema>;
