import { boolean, date, decimal, integer, jsonb, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const visitors = zameen.table('visitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  visitorName: text('visitor_name').notNull(),
  cnic: text('cnic'),
  phone: text('phone'),
  organization: text('organization'),
  vehicleRegistration: text('vehicle_registration'),
  visitPurpose: text('visit_purpose').notNull(),
  signedInAt: timestamp('signed_in_at', { withTimezone: true }).notNull().defaultNow(),
  signedOutAt: timestamp('signed_out_at', { withTimezone: true }),
  escortedBy: uuid('escorted_by'),
  fieldsVisited: uuid('fields_visited').array(),
  livestockAreasVisited: boolean('livestock_areas_visited').notNull().default(false),
  biosecurityCheckPassed: boolean('biosecurity_check_passed').notNull().default(false),
  biosecurityFailures: text('biosecurity_failures').array(),
  photoIdUrl: text('photo_id_url'),
  signatureUrl: text('signature_url'),
  healthDeclarationSigned: boolean('health_declaration_signed').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const biosecurityProtocols = zameen.table('biosecurity_protocols', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  zone: text('zone').notNull(),
  protocolName: text('protocol_name').notNull(),
  protocolKind: text('protocol_kind').notNull(),
  description: text('description'),
  enforcementLevel: text('enforcement_level').notNull(),
  appliesTo: text('applies_to').array().notNull().default(['visitors', 'workers', 'vehicles']),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const diseaseOutbreaks = zameen.table('disease_outbreaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  outbreakKind: text('outbreak_kind').notNull(),
  detectedOn: date('detected_on').notNull(),
  affectedArea: text('affected_area'),
  affectedAnimalIds: uuid('affected_animal_ids').array(),
  affectedFieldIds: uuid('affected_field_ids').array(),
  sourceSuspected: text('source_suspected'),
  containmentZonePolygon: jsonb('containment_zone_polygon'),
  containmentStartedOn: date('containment_started_on'),
  containmentEndedOn: date('containment_ended_on'),
  totalAffectedCount: integer('total_affected_count'),
  totalLostCount: integer('total_lost_count'),
  totalTreatmentCostPkr: numeric('total_treatment_cost_pkr', { precision: 14, scale: 2 }),
  status: text('status').notNull().default('active'),
  reportedToAuthority: text('reported_to_authority'),
  authorityReference: text('authority_reference'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quarantineRecords = zameen.table('quarantine_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  subjectKind: text('subject_kind').notNull(),
  subjectId: uuid('subject_id'),
  reason: text('reason').notNull(),
  relatedOutbreakId: uuid('related_outbreak_id').references(() => diseaseOutbreaks.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: text('status').notNull().default('active'),
  dailyObservationRequired: boolean('daily_observation_required').notNull().default(true),
  releasedBy: uuid('released_by'),
  releaseNotes: text('release_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Silence unused decimal import in case future fields need it.
export const _decimalRef = decimal;
