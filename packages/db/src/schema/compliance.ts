import { decimal, jsonb, text, timestamp, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { documentTypeEnum } from './enums.js';

export const documents = zameen.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  documentType: documentTypeEnum('document_type').notNull(),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  mimeType: varchar('mime_type', { length: 64 }),
  issuedOn: date('issued_on'),
  expiresOn: date('expires_on'),
  metadata: jsonb('metadata'),
  uploadedBy: uuid('uploaded_by'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taxFilings = zameen.table('tax_filings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  taxKind: varchar('tax_kind', { length: 32 }).notNull(),
  periodLabel: varchar('period_label', { length: 32 }).notNull(),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }).notNull(),
  filedOn: date('filed_on'),
  challanNumber: varchar('challan_number', { length: 64 }),
  challanPhotoUrl: text('challan_photo_url'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
});

export const subsidyTransactions = zameen.table('subsidy_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  programName: varchar('program_name', { length: 64 }).notNull(),
  applicationDate: date('application_date'),
  approvedDate: date('approved_date'),
  receivedDate: date('received_date'),
  amountPkr: decimal('amount_pkr', { precision: 14, scale: 2 }),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  notes: text('notes'),
});

export const sprayDiaries = zameen.table('spray_diaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').notNull(),
  cropPlanId: uuid('crop_plan_id'),
  sprayedOn: date('sprayed_on').notNull(),
  pesticideName: text('pesticide_name').notNull(),
  activeIngredient: text('active_ingredient'),
  doseLitresPerAcre: decimal('dose_litres_per_acre', { precision: 6, scale: 3 }),
  totalLitresUsed: decimal('total_litres_used', { precision: 8, scale: 2 }),
  applicator: text('applicator'),
  weatherConditions: jsonb('weather_conditions'),
  preHarvestIntervalDays: decimal('pre_harvest_interval_days', { precision: 4, scale: 0 }),
  notes: text('notes'),
});
