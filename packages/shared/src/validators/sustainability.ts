import { z } from 'zod';
import { SUSTAINABILITY_PRACTICE_KINDS, CARBON_CREDIT_STANDARDS } from '../constants.js';

export const sustainabilityPracticeSchema = z.object({
  entityId: z.string().uuid(),
  fieldId: z.string().uuid().nullable().optional(),
  practiceKind: z.enum(SUSTAINABILITY_PRACTICE_KINDS),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  areaAcres: z.number().nonnegative().nullable().optional(),
  baselineMetric: z.record(z.string(), z.unknown()).nullable().optional(),
  currentMetric: z.record(z.string(), z.unknown()).nullable().optional(),
  evidenceUrls: z.array(z.string().url()).default([]),
  verifier: z.string().max(200).nullable().optional(),
  verificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  certification: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type SustainabilityPracticeInput = z.infer<typeof sustainabilityPracticeSchema>;

export const carbonAssessmentSchema = z.object({
  entityId: z.string().uuid(),
  fieldId: z.string().uuid().nullable().optional(),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimatedTubewellKwh: z.number().nonnegative().optional(),
  estimatedInputTransportTonKm: z.number().nonnegative().optional(),
  methodology: z.string().max(500).optional(),
  baselineYear: z.number().int().min(1990).max(2100).optional(),
  notes: z.string().max(2000).optional(),
});
export type CarbonAssessmentInput = z.infer<typeof carbonAssessmentSchema>;

export const carbonCreditIssuanceSchema = z.object({
  entityId: z.string().uuid(),
  creditNumber: z.string().max(64).optional(),
  issuedBy: z.string().max(200).optional(),
  standard: z.enum(CARBON_CREDIT_STANDARDS),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vintageYear: z.number().int().min(1990).max(2100),
  quantityTco2e: z.number().positive(),
  relatedPracticeIds: z.array(z.string().uuid()).optional(),
  relatedAssessmentId: z.string().uuid().optional(),
  certificateUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});
export type CarbonCreditIssuanceInput = z.infer<typeof carbonCreditIssuanceSchema>;

export const carbonCreditSaleSchema = z.object({
  creditId: z.string().uuid(),
  soldTo: z.string().min(2).max(200),
  soldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  soldPricePerTonPkr: z.number().positive(),
  notes: z.string().max(2000).optional(),
});
export type CarbonCreditSaleInput = z.infer<typeof carbonCreditSaleSchema>;

export const carbonCreditRetirementSchema = z.object({
  creditId: z.string().uuid(),
  retirementReason: z.string().min(2).max(500),
});
export type CarbonCreditRetirementInput = z.infer<typeof carbonCreditRetirementSchema>;

export const esgSnapshotSchema = z.object({
  entityId: z.string().uuid(),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  environmental: z.object({
    netCo2eTons: z.number(),
    waterUsedM3: z.number().nonnegative().optional(),
    waterSavedM3: z.number().nonnegative().optional(),
    renewableEnergyKwh: z.number().nonnegative().optional(),
    syntheticFertilizerKg: z.number().nonnegative().optional(),
    pesticideKg: z.number().nonnegative().optional(),
    biodiversityNotes: z.string().optional(),
  }),
  social: z.object({
    headcount: z.number().int().nonnegative(),
    femaleHeadcountPct: z.number().min(0).max(100).optional(),
    safetyIncidents: z.number().int().nonnegative().optional(),
    trainingHours: z.number().nonnegative().optional(),
    avgWagePkr: z.number().nonnegative().optional(),
    communityInvestmentPkr: z.number().nonnegative().optional(),
  }),
  governance: z.object({
    boardMeetingsHeld: z.number().int().nonnegative().optional(),
    auditCompleted: z.boolean().optional(),
    approvalsRecorded: z.number().int().nonnegative().optional(),
    grievancesResolvedPct: z.number().min(0).max(100).optional(),
    complianceFilingsOnTimePct: z.number().min(0).max(100).optional(),
  }),
  framework: z.string().max(64).optional(),
  notes: z.string().max(4000).optional(),
});
export type EsgSnapshotInput = z.infer<typeof esgSnapshotSchema>;
