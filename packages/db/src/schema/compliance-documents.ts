import { boolean, date, decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';
import { assets } from './assets.js';
import { workers } from './labor.js';

/**
 * Compliance documents: land records, licenses, KYC, insurance certs.
 * Tracks issuance + expiry windows so a daily edge function can fire alerts
 * at T-90 / T-60 / T-30 / T-7 / T-0.
 */
export const complianceDocuments: ReturnType<typeof zameen.table> = zameen.table('compliance_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  docKind: text('doc_kind').notNull(),
  title: text('title').notNull(),
  referenceNumber: text('reference_number'),
  issuingAuthority: text('issuing_authority'),
  issuedOn: date('issued_on'),
  expiresOn: date('expires_on'),
  relatedFieldId: uuid('related_field_id').references(() => fields.id),
  relatedAssetId: uuid('related_asset_id').references(() => assets.id),
  relatedWorkerId: uuid('related_worker_id').references(() => workers.id),
  storageUrl: text('storage_url').notNull(),
  notes: text('notes'),
  status: text('status').notNull().default('active'),
  supersededById: uuid('superseded_by_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type NewComplianceDocument = typeof complianceDocuments.$inferInsert;

/**
 * Government schemes catalogue (Punjab + Federal). Seeded with the active list.
 * Read-only for end users; admins add/retire schemes via direct migration.
 */
export const governmentSchemes = zameen.table('government_schemes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  authority: text('authority').notNull(),
  schemeType: text('scheme_type'),
  description: text('description'),
  eligibilityCriteria: jsonb('eligibility_criteria'),
  benefitSummary: text('benefit_summary'),
  applicationUrl: text('application_url'),
  activeFrom: date('active_from'),
  activeTo: date('active_to'),
  isActive: boolean('is_active').notNull().default(true),
  region: text('region'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GovernmentScheme = typeof governmentSchemes.$inferSelect;
export type NewGovernmentScheme = typeof governmentSchemes.$inferInsert;

/**
 * Entity-specific applications against a scheme. Status walks the standard
 * planning -> prepared -> submitted -> under_review -> approved -> disbursed -> closed chain
 * (or rejected at any review step).
 */
export const schemeApplications = zameen.table('scheme_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  schemeId: uuid('scheme_id').notNull().references(() => governmentSchemes.id),
  appliedOn: date('applied_on'),
  referenceNumber: text('reference_number'),
  applicantName: text('applicant_name'),
  status: text('status').notNull().default('planning'),
  expectedBenefitPkr: decimal('expected_benefit_pkr', { precision: 14, scale: 2 }),
  actualBenefitPkr: decimal('actual_benefit_pkr', { precision: 14, scale: 2 }),
  disbursedOn: date('disbursed_on'),
  notes: text('notes'),
  attachments: jsonb('attachments').notNull().default([] as unknown as object),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SchemeApplication = typeof schemeApplications.$inferSelect;
export type NewSchemeApplication = typeof schemeApplications.$inferInsert;
