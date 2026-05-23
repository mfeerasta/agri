import { boolean, date, decimal, integer, jsonb, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { workers } from './labor.js';
import { fields } from './land.js';
import { assets } from './assets.js';

export const trainingPrograms = zameen.table('training_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  category: text('category').notNull(),
  requiredForRoles: text('required_for_roles').array().notNull().default([]),
  validityMonths: integer('validity_months'),
  passingScorePct: numeric('passing_score_pct', { precision: 5, scale: 2 }),
  contentUrl: text('content_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trainingCompletions = zameen.table('training_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').notNull().references(() => trainingPrograms.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  completedOn: date('completed_on').notNull(),
  scorePct: numeric('score_pct', { precision: 5, scale: 2 }),
  passed: boolean('passed').notNull().default(false),
  expiresOn: date('expires_on'),
  trainerName: text('trainer_name'),
  certificateUrl: text('certificate_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const safetyIncidents = zameen.table('safety_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  reportedBy: uuid('reported_by'),
  workerId: uuid('worker_id').references(() => workers.id),
  fieldId: uuid('field_id').references(() => fields.id),
  assetId: uuid('asset_id').references(() => assets.id),
  severity: text('severity').notNull(),
  category: text('category'),
  description: text('description').notNull(),
  bodyPartAffected: text('body_part_affected'),
  injuryType: text('injury_type'),
  immediateActionTaken: text('immediate_action_taken'),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  correctiveActionDueOn: date('corrective_action_due_on'),
  correctiveActionCompletedOn: date('corrective_action_completed_on'),
  medicalAttentionRequired: boolean('medical_attention_required').notNull().default(false),
  medicalCostPkr: decimal('medical_cost_pkr', { precision: 14, scale: 2 }),
  lostDays: integer('lost_days').notNull().default(0),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('open'),
  approvalRequestId: uuid('approval_request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ppeIssuances = zameen.table('ppe_issuances', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  ppeKind: text('ppe_kind').notNull(),
  issuedOn: date('issued_on').notNull(),
  quantity: integer('quantity').notNull().default(1),
  expiresOn: date('expires_on'),
  acknowledgementSigned: boolean('acknowledgement_signed').notNull().default(false),
  costPkr: decimal('cost_pkr', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const TRAINING_CATEGORIES = [
  'safety',
  'technical',
  'equipment',
  'agronomy',
  'compliance',
  'soft_skills',
  'first_aid',
  'pesticide_handling',
  'machinery_operation',
] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

export const SAFETY_SEVERITIES = [
  'near_miss',
  'first_aid',
  'medical_treatment',
  'lost_time',
  'fatality',
  'property_only',
] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];

export const SAFETY_CATEGORIES = [
  'pesticide_exposure',
  'machinery',
  'heat_stress',
  'fall',
  'animal',
  'electrical',
  'fire',
  'snake_bite',
  'other',
] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const PPE_KINDS = [
  'mask_n95',
  'respirator',
  'goggles',
  'gloves_chemical',
  'gloves_general',
  'overalls',
  'boots',
  'helmet',
  'high_vis_vest',
  'ear_protection',
  'sunscreen',
  'first_aid_kit',
  'other',
] as const;
export type PpeKind = (typeof PPE_KINDS)[number];

export const WORKER_DOC_KINDS = [
  'cnic',
  'passport',
  'driver_license',
  'medical_certificate',
  'training_certificate',
  'contract',
  'reference_letter',
  'character_certificate',
  'vaccination_record',
  'other',
] as const;
export type WorkerDocKind = (typeof WORKER_DOC_KINDS)[number];
