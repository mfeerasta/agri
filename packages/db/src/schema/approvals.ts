import { decimal, jsonb, text, timestamp, uuid, varchar, integer, boolean } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';
import { approvalActionEnum, approvalStateEnum, approvalTypeEnum } from './enums.js';

export const approvalWorkflows = zameen.table('approval_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  approvalType: approvalTypeEnum('approval_type').notNull(),
  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  thresholdsPkr: jsonb('thresholds_pkr').notNull(),
  notes: text('notes'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
});

export const approvalRequests = zameen.table('approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  approvalType: approvalTypeEnum('approval_type').notNull(),
  workflowId: uuid('workflow_id').references(() => approvalWorkflows.id),
  state: approvalStateEnum('state').notNull().default('draft'),
  sourceModule: varchar('source_module', { length: 32 }).notNull(),
  sourceRecordId: uuid('source_record_id'),
  title: text('title').notNull(),
  titleUr: text('title_ur'),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }),
  payload: jsonb('payload').notNull(),
  contextSnapshot: jsonb('context_snapshot'),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  currentApproverId: uuid('current_approver_id').references(() => users.id),
  nextEscalationAt: timestamp('next_escalation_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  emergencyExecuted: boolean('emergency_executed').notNull().default(false),
  emergencyJustification: text('emergency_justification'),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
  reversedBy: uuid('reversed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const approvalActions = zameen.table('approval_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  approvalRequestId: uuid('approval_request_id')
    .notNull()
    .references(() => approvalRequests.id, { onDelete: 'cascade' }),
  action: approvalActionEnum('action').notNull(),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  actorRole: varchar('actor_role', { length: 24 }).notNull(),
  fromState: approvalStateEnum('from_state'),
  toState: approvalStateEnum('to_state'),
  comment: text('comment'),
  commentUr: text('comment_ur'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  gpsLocation: jsonb('gps_location'),
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const feasibilityStudies = zameen.table('feasibility_studies', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  approvalRequestId: uuid('approval_request_id').references(() => approvalRequests.id),
  studyNumber: varchar('study_number', { length: 32 }).notNull().unique(),
  title: text('title').notNull(),
  titleUr: text('title_ur'),
  proposedBy: uuid('proposed_by').notNull().references(() => users.id),
  background: text('background').notNull(),
  scope: jsonb('scope').notNull(),
  capexEstimatePkr: decimal('capex_estimate_pkr', { precision: 16, scale: 2 }).notNull().default('0'),
  opexEstimatePkr: decimal('opex_estimate_pkr', { precision: 16, scale: 2 }).notNull().default('0'),
  costBreakdown: jsonb('cost_breakdown').notNull(),
  revenueProjection: jsonb('revenue_projection').notNull(),
  yieldAssumptions: jsonb('yield_assumptions'),
  priceAssumptions: jsonb('price_assumptions'),
  sensitivity: jsonb('sensitivity'),
  riskAssessment: jsonb('risk_assessment').notNull(),
  statusQuoComparison: jsonb('status_quo_comparison'),
  decision: varchar('decision', { length: 32 }),
  decisionConditions: text('decision_conditions'),
  postExecutionReviewDate: timestamp('post_execution_review_date', { withTimezone: true }),
  postReviewOutcome: jsonb('post_review_outcome'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const feasibilityAttachments = zameen.table('feasibility_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  feasibilityStudyId: uuid('feasibility_study_id')
    .notNull()
    .references(() => feasibilityStudies.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  mimeType: varchar('mime_type', { length: 64 }),
  uploadedBy: uuid('uploaded_by'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const feasibilityComments = zameen.table('feasibility_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  feasibilityStudyId: uuid('feasibility_study_id')
    .notNull()
    .references(() => feasibilityStudies.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  bodyUr: text('body_ur'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
