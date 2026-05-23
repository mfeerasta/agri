import { boolean, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const signingEnvelopes = zameen.table('signing_envelopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  envelopeNumber: text('envelope_number').notNull(),
  title: text('title').notNull(),
  documentKind: text('document_kind').notNull(),
  status: text('status').notNull().default('draft'),
  sourceRecordKind: text('source_record_kind'),
  sourceRecordId: uuid('source_record_id'),
  templateId: uuid('template_id'),
  pdfStorageUrl: text('pdf_storage_url').notNull(),
  pdfSha256: text('pdf_sha256').notNull(),
  signedPdfUrl: text('signed_pdf_url'),
  signedPdfSha256: text('signed_pdf_sha256'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  initiatedBy: uuid('initiated_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const envelopeSigners = zameen.table('envelope_signers', {
  id: uuid('id').primaryKey().defaultRandom(),
  envelopeId: uuid('envelope_id').notNull().references(() => signingEnvelopes.id, { onDelete: 'cascade' }),
  signingOrder: integer('signing_order').notNull(),
  signerName: text('signer_name').notNull(),
  signerEmail: text('signer_email'),
  signerPhone: text('signer_phone'),
  signerCnic: text('signer_cnic'),
  signerRole: text('signer_role').notNull(),
  isZameenUser: boolean('is_zameen_user').notNull().default(false),
  zameenUserId: uuid('zameen_user_id'),
  status: text('status').notNull().default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  declineReason: text('decline_reason'),
  accessToken: text('access_token').unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  signatureImageUrl: text('signature_image_url'),
  consentTextAccepted: boolean('consent_text_accepted').notNull().default(false),
  identityVerificationMethod: text('identity_verification_method'),
  identityVerifiedAt: timestamp('identity_verified_at', { withTimezone: true }),
  otpCodeHash: text('otp_code_hash'),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  otpAttempts: integer('otp_attempts').notNull().default(0),
});

export const signatureAuditEvents = zameen.table('signature_audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  envelopeId: uuid('envelope_id').notNull().references(() => signingEnvelopes.id, { onDelete: 'cascade' }),
  signerId: uuid('signer_id').references(() => envelopeSigners.id),
  eventKind: text('event_kind').notNull(),
  eventAt: timestamp('event_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  payload: jsonb('payload'),
});

export const signingTemplates = zameen.table('signing_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => entities.id),
  name: text('name').notNull(),
  documentKind: text('document_kind').notNull(),
  templatePdfUrl: text('template_pdf_url'),
  bodyHtml: text('body_html'),
  bodyHtmlUr: text('body_html_ur'),
  variableSchema: jsonb('variable_schema'),
  defaultConsentText: text('default_consent_text'),
  defaultConsentTextUr: text('default_consent_text_ur'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SigningEnvelope = typeof signingEnvelopes.$inferSelect;
export type NewSigningEnvelope = typeof signingEnvelopes.$inferInsert;
export type EnvelopeSigner = typeof envelopeSigners.$inferSelect;
export type NewEnvelopeSigner = typeof envelopeSigners.$inferInsert;
export type SignatureAuditEvent = typeof signatureAuditEvents.$inferSelect;
export type SigningTemplate = typeof signingTemplates.$inferSelect;
