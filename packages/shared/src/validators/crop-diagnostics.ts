import { z } from 'zod';

export const diagnosticSeverityEnum = z.enum(['mild', 'moderate', 'severe', 'unknown']);
export const diagnosticStatusEnum = z.enum(['pending_review', 'confirmed', 'dismissed', 'treated', 'resolved']);
export const diagnosticSourceEnum = z.enum(['claude_vision', 'gpt_vision', 'expert_override', 'plant_id_api']);

export const diagnosticAlternativeSchema = z.object({
  label: z.string().min(1).max(256),
  confidence: z.coerce.number().min(0).max(1),
  reason: z.string().max(1024).default(''),
});

export const diagnosticResultSchema = z.object({
  diagnosisLabel: z.string().min(1).max(256),
  confidence: z.coerce.number().min(0).max(1),
  severity: diagnosticSeverityEnum,
  treatmentSuggestion: z.string().max(4096).default(''),
  treatmentSuggestionUr: z.string().max(4096).default(''),
  alternativeDiagnoses: z.array(diagnosticAlternativeSchema).max(5).default([]),
  preventiveAdvice: z.string().max(2048).default(''),
  rawText: z.string().default(''),
});
export type DiagnosticResultShape = z.infer<typeof diagnosticResultSchema>;

export const cropDiagnosticCreateSchema = z.object({
  imageUrl: z.string().url(),
  fieldId: z.string().uuid(),
  cropPlanId: z.string().uuid().optional(),
  stageLogId: z.string().uuid().optional(),
  observedOn: z.string().optional(),
  cropName: z.string().max(128).optional(),
  stage: z.string().max(64).optional(),
  fieldHistoryHints: z.string().max(1024).optional(),
});
export type CropDiagnosticCreateInput = z.infer<typeof cropDiagnosticCreateSchema>;

export const cropDiagnosticReviewSchema = z.object({
  id: z.string().uuid(),
  status: diagnosticStatusEnum,
});
export type CropDiagnosticReviewInput = z.infer<typeof cropDiagnosticReviewSchema>;
