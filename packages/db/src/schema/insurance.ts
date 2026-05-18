import { date, decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { documents } from './compliance.js';

export const insurancePolicies = zameen.table('insurance_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  policyNumber: text('policy_number').notNull(),
  insurerName: text('insurer_name').notNull(),
  policyKind: text('policy_kind').notNull(),
  coveragePkr: decimal('coverage_pkr', { precision: 14, scale: 2 }).notNull(),
  premiumPkr: decimal('premium_pkr', { precision: 14, scale: 2 }).notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to').notNull(),
  fieldsCovered: jsonb('fields_covered').$type<string[]>().default([]),
  animalsCovered: jsonb('animals_covered').$type<string[]>().default([]),
  assetsCovered: jsonb('assets_covered').$type<string[]>().default([]),
  attachedDocId: uuid('attached_doc_id').references(() => documents.id),
  approvalRequestId: uuid('approval_request_id'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insuranceClaims = zameen.table('insurance_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => insurancePolicies.id, { onDelete: 'cascade' }),
  claimNumber: text('claim_number'),
  incidentDate: date('incident_date').notNull(),
  reportedDate: date('reported_date').notNull().defaultNow(),
  cause: text('cause').notNull(),
  affectedFieldIds: jsonb('affected_field_ids').$type<string[]>().default([]),
  affectedAnimalIds: jsonb('affected_animal_ids').$type<string[]>().default([]),
  estimatedLossPkr: decimal('estimated_loss_pkr', { precision: 14, scale: 2 }).notNull(),
  claimedPkr: decimal('claimed_pkr', { precision: 14, scale: 2 }).notNull(),
  settledPkr: decimal('settled_pkr', { precision: 14, scale: 2 }),
  status: text('status').notNull().default('reported'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
