import { boolean, date, decimal, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { produceLots } from './inventory.js';

export const qualityLabTests = zameen.table('quality_lab_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  produceLotId: uuid('produce_lot_id').references(() => produceLots.id, { onDelete: 'cascade' }),
  harvestRecordId: uuid('harvest_record_id'),
  testKind: text('test_kind').notNull(),
  testedOn: date('tested_on').notNull(),
  laboratory: text('laboratory'),
  labReference: text('lab_reference'),
  resultValue: decimal('result_value', { precision: 14, scale: 4 }),
  resultUnit: text('result_unit'),
  resultPassFail: text('result_pass_fail'),
  specMin: decimal('spec_min', { precision: 14, scale: 4 }),
  specMax: decimal('spec_max', { precision: 14, scale: 4 }),
  reportUrl: text('report_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gradingStandards = zameen.table(
  'grading_standards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    cropCode: text('crop_code').notNull(),
    grade: text('grade').notNull(),
    criteria: jsonb('criteria').$type<Record<string, number>>().notNull(),
    buyerSpecific: text('buyer_specific'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    gsUq: uniqueIndex('grading_standards_uq').on(t.entityId, t.cropCode, t.grade, t.buyerSpecific),
  }),
);

export const cleaningDryingEvents = zameen.table('cleaning_drying_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  produceLotId: uuid('produce_lot_id').notNull().references(() => produceLots.id, { onDelete: 'cascade' }),
  eventKind: text('event_kind').notNull(),
  occurredOn: date('occurred_on').notNull(),
  inputQuantityKg: decimal('input_quantity_kg', { precision: 14, scale: 2 }),
  outputQuantityKg: decimal('output_quantity_kg', { precision: 14, scale: 2 }),
  shrinkageKg: decimal('shrinkage_kg', { precision: 14, scale: 2 }),
  shrinkagePct: decimal('shrinkage_pct', { precision: 5, scale: 2 }),
  costPkr: decimal('cost_pkr', { precision: 14, scale: 2 }),
  durationHours: decimal('duration_hours', { precision: 8, scale: 2 }),
  operatorId: uuid('operator_id'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const qualityComplaints = zameen.table('quality_complaints', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  relatedLotId: uuid('related_lot_id').references(() => produceLots.id),
  relatedDispatchId: uuid('related_dispatch_id'),
  raisedOn: date('raised_on').notNull(),
  raisedByBuyer: text('raised_by_buyer').notNull(),
  complaintKind: text('complaint_kind'),
  severity: text('severity').notNull(),
  claimedLossPkr: decimal('claimed_loss_pkr', { precision: 14, scale: 2 }),
  resolution: text('resolution'),
  resolvedPkr: decimal('resolved_pkr', { precision: 14, scale: 2 }),
  resolvedOn: date('resolved_on'),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  photoUrls: jsonb('photo_urls').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type QualityLabTest = typeof qualityLabTests.$inferSelect;
export type GradingStandard = typeof gradingStandards.$inferSelect;
export type CleaningDryingEvent = typeof cleaningDryingEvents.$inferSelect;
export type QualityComplaint = typeof qualityComplaints.$inferSelect;
