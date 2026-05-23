import { decimal, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { landTenureEnum } from './enums.js';

// NOTE: `blocks.geometry` and `fields.geometry` are declared as jsonb here so
// the initial Drizzle migration creates them cleanly. After migration
// `supabase/migrations/0006_geometry_columns.sql` runs, those columns become
// `geometry(MultiPolygon, 4326)` in the live database. Writes must go through
// the SQL helper `zameen.geom_from_json(text)` (see seed.ts), and reads should
// project via `ST_AsGeoJSON(geometry)::jsonb`. See
// `docs/decisions.md` (2026-05-17 entry on PostGIS) for full rationale.
// TODO Phase 2: swap to a proper PostGIS Drizzle plugin once we wire the
// Mapbox field-polygon editor.

export const farms = zameen.table('farms', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 16 }).notNull(),
  name: text('name').notNull(),
  nameUr: text('name_ur'),
  district: varchar('district', { length: 64 }),
  tehsil: varchar('tehsil', { length: 64 }),
  village: varchar('village', { length: 64 }),
  centroid: jsonb('centroid'),
  totalAcres: decimal('total_acres', { precision: 12, scale: 4 }),
  soilGridsData: jsonb('soil_grids_data'),
  soilGridsFetchedAt: timestamp('soil_grids_fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const blocks = zameen.table('blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').notNull().references(() => farms.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 16 }).notNull(),
  name: text('name'),
  acres: decimal('acres', { precision: 12, scale: 4 }),
  geometry: jsonb('geometry'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fields = zameen.table('fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  blockId: uuid('block_id').notNull().references(() => blocks.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 16 }).notNull(),
  name: text('name'),
  nameUr: text('name_ur'),
  acres: decimal('acres', { precision: 12, scale: 4 }).notNull(),
  geometry: jsonb('geometry').notNull(),
  khasraNumbers: jsonb('khasra_numbers').$type<string[]>().notNull().default([]),
  khatooniNumber: varchar('khatooni_number', { length: 32 }),
  tenure: landTenureEnum('tenure').notNull().default('owned'),
  tenureDetails: jsonb('tenure_details'),
  soilGridsData: jsonb('soil_grids_data'),
  soilGridsFetchedAt: timestamp('soil_grids_fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const plots = zameen.table('plots', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 16 }).notNull(),
  acres: decimal('acres', { precision: 12, scale: 4 }).notNull(),
  geometry: jsonb('geometry'),
});

export const soilTests = zameen.table('soil_tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  testedOn: timestamp('tested_on', { withTimezone: true }).notNull(),
  laboratory: text('laboratory'),
  ph: decimal('ph', { precision: 4, scale: 2 }),
  nitrogenPpm: decimal('nitrogen_ppm', { precision: 8, scale: 2 }),
  phosphorusPpm: decimal('phosphorus_ppm', { precision: 8, scale: 2 }),
  potassiumPpm: decimal('potassium_ppm', { precision: 8, scale: 2 }),
  organicMatterPct: decimal('organic_matter_pct', { precision: 5, scale: 2 }),
  texture: varchar('texture', { length: 32 }),
  salinityEc: decimal('salinity_ec', { precision: 6, scale: 2 }),
  fullReport: jsonb('full_report'),
  reportUrl: text('report_url'),
});

export const waterSources = zameen.table('water_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  farmId: uuid('farm_id').notNull().references(() => farms.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 32 }).notNull(),
  identifier: varchar('identifier', { length: 64 }),
  schedule: jsonb('schedule'),
  licenseDocId: uuid('license_doc_id'),
  location: jsonb('location'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const landTenureRecords = zameen.table('land_tenure_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  tenure: landTenureEnum('tenure').notNull(),
  counterparty: text('counterparty'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  annualRentPkr: decimal('annual_rent_pkr', { precision: 14, scale: 2 }),
  termsJsonb: jsonb('terms'),
  deedDocId: uuid('deed_doc_id'),
});
