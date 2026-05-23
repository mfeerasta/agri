import { boolean, date, decimal, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { assets } from './assets.js';
import { fields } from './land.js';

export const energyMeters = zameen.table('energy_meters', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  meterNumber: text('meter_number').notNull(),
  meterKind: text('meter_kind').notNull(),
  assetId: uuid('asset_id').references(() => assets.id),
  fieldId: uuid('field_id').references(() => fields.id),
  capacityKw: decimal('capacity_kw', { precision: 10, scale: 3 }),
  tariffPkrPerKwh: decimal('tariff_pkr_per_kwh', { precision: 10, scale: 4 }),
  connectionKind: text('connection_kind'),
  referenceNumber: text('reference_number'),
  installedOn: date('installed_on'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const energyReadings = zameen.table('energy_readings', {
  id: uuid('id').primaryKey().defaultRandom(),
  meterId: uuid('meter_id').notNull().references(() => energyMeters.id, { onDelete: 'cascade' }),
  readingDate: date('reading_date').notNull(),
  readingTime: text('reading_time').notNull().default('on_peak'),
  consumptionKwh: decimal('consumption_kwh', { precision: 12, scale: 3 }),
  generationKwh: decimal('generation_kwh', { precision: 12, scale: 3 }),
  exportKwh: decimal('export_kwh', { precision: 12, scale: 3 }),
  readingValue: decimal('reading_value', { precision: 14, scale: 3 }).notNull(),
  costPkr: decimal('cost_pkr', { precision: 14, scale: 2 }),
  billUrl: text('bill_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const solarSystems = zameen.table('solar_systems', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  installationName: text('installation_name').notNull(),
  panelsCount: integer('panels_count').notNull(),
  totalCapacityKw: decimal('total_capacity_kw', { precision: 10, scale: 3 }).notNull(),
  panelModel: text('panel_model'),
  inverterModel: text('inverter_model'),
  batteryCapacityKwh: decimal('battery_capacity_kwh', { precision: 10, scale: 3 }),
  installer: text('installer'),
  commissionedOn: date('commissioned_on').notNull(),
  warrantyUntil: date('warranty_until'),
  costPkr: decimal('cost_pkr', { precision: 14, scale: 2 }),
  costPerKwPkr: decimal('cost_per_kw_pkr', { precision: 12, scale: 2 }),
  estimatedAnnualGenerationKwh: decimal('estimated_annual_generation_kwh', { precision: 14, scale: 2 }),
  netMeteringApproved: boolean('net_metering_approved').notNull().default(false),
  notes: text('notes'),
});

export const generatorRuns = zameen.table('generator_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  hoursRun: decimal('hours_run', { precision: 8, scale: 2 }),
  dieselConsumedLiters: decimal('diesel_consumed_liters', { precision: 10, scale: 2 }),
  outputKwhEstimated: decimal('output_kwh_estimated', { precision: 12, scale: 2 }),
  reason: text('reason'),
  fuelCostPkr: decimal('fuel_cost_pkr', { precision: 14, scale: 2 }),
  operatorId: uuid('operator_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
