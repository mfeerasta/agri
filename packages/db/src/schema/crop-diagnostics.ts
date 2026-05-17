import { date, decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { fields } from './land.js';
import { cropPlans, cropStageLogs } from './crops.js';

// Crop disease photo diagnostics. One row per analyzed photo. Treatment
// suggestions are bilingual (en + ur). Status workflow:
// pending_review -> confirmed/dismissed -> treated -> resolved.

export type DiagnosticAlternative = {
  label: string;
  confidence: number;
  reason: string;
};

export const cropDiagnostics = zameen.table('crop_diagnostics', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropPlanId: uuid('crop_plan_id').references(() => cropPlans.id, { onDelete: 'set null' }),
  stageLogId: uuid('stage_log_id').references(() => cropStageLogs.id, { onDelete: 'set null' }),
  photoUrl: text('photo_url').notNull(),
  observedOn: date('observed_on').notNull(),
  reportedBy: uuid('reported_by'),
  diagnosisLabel: text('diagnosis_label'),
  confidence: decimal('confidence', { precision: 5, scale: 4 }),
  severity: text('severity'),
  treatmentSuggestion: text('treatment_suggestion'),
  treatmentSuggestionUr: text('treatment_suggestion_ur'),
  alternativeDiagnoses: jsonb('alternative_diagnoses').$type<DiagnosticAlternative[]>().notNull().default([]),
  source: text('source').notNull().default('claude_vision'),
  status: text('status').notNull().default('pending_review'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CropDiagnosticSeverity = 'mild' | 'moderate' | 'severe' | 'unknown';
export type CropDiagnosticStatus = 'pending_review' | 'confirmed' | 'dismissed' | 'treated' | 'resolved';
export type CropDiagnosticSource = 'claude_vision' | 'gpt_vision' | 'expert_override' | 'plant_id_api';
