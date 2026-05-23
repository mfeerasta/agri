import { boolean, date, decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export type ProcessKind =
  | 'wheat_milling'
  | 'rice_milling'
  | 'dairy_processing'
  | 'oil_extraction'
  | 'cotton_ginning'
  | 'sugar_processing'
  | 'gur_making'
  | 'fodder_processing'
  | 'seed_cleaning'
  | 'feed_mixing'
  | 'packaging'
  | 'other';

export interface RecipeInputSpec {
  crop: string;
  quantityKg: number;
  grade?: 'a' | 'b' | 'c';
}

export interface RecipeOutputSpec {
  name: string;
  quantityKg: number;
  grade?: 'a' | 'b' | 'c';
}

export interface RecipeByproductSpec {
  kind: string;
  quantityKg: number;
}

export interface RunInputUsed {
  produceLotId?: string;
  crop: string;
  quantityKg: number;
  unitCostPkr: number;
}

export interface RunOutputProduced {
  name: string;
  quantityKg: number;
  grade?: 'a' | 'b' | 'c';
  storageLocationId?: string;
  producedLotId?: string;
}

export const processingRecipes = zameen.table('processing_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  processKind: text('process_kind').notNull().$type<ProcessKind>(),
  inputs: jsonb('inputs').$type<RecipeInputSpec[]>().notNull(),
  outputs: jsonb('outputs').$type<RecipeOutputSpec[]>().notNull(),
  byproducts: jsonb('byproducts').$type<RecipeByproductSpec[]>(),
  energyKwhPerUnit: decimal('energy_kwh_per_unit', { precision: 8, scale: 3 }),
  labourMinutesPerUnit: decimal('labour_minutes_per_unit', { precision: 8, scale: 2 }),
  expectedTotalYieldPct: decimal('expected_total_yield_pct', { precision: 5, scale: 2 }),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const processingRuns = zameen.table('processing_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  recipeId: uuid('recipe_id').notNull().references(() => processingRecipes.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationHours: decimal('duration_hours', { precision: 8, scale: 2 }),
  inputsUsed: jsonb('inputs_used').$type<RunInputUsed[]>().notNull(),
  outputsProduced: jsonb('outputs_produced').$type<RunOutputProduced[]>().notNull(),
  actualYieldPct: decimal('actual_yield_pct', { precision: 5, scale: 2 }),
  varianceFromExpectedPct: decimal('variance_from_expected_pct', { precision: 6, scale: 2 }),
  totalInputCostPkr: decimal('total_input_cost_pkr', { precision: 14, scale: 2 }),
  energyCostPkr: decimal('energy_cost_pkr', { precision: 14, scale: 2 }),
  labourCostPkr: decimal('labour_cost_pkr', { precision: 14, scale: 2 }),
  overheadCostPkr: decimal('overhead_cost_pkr', { precision: 14, scale: 2 }),
  totalRunCostPkr: decimal('total_run_cost_pkr', { precision: 14, scale: 2 }),
  perUnitOutputCostPkr: jsonb('per_unit_output_cost_pkr').$type<Record<string, number>>(),
  operatorId: uuid('operator_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const byproductInventory = zameen.table('byproduct_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  processingRunId: uuid('processing_run_id').notNull().references(() => processingRuns.id, { onDelete: 'cascade' }),
  byproductKind: text('byproduct_kind').notNull(),
  quantityKg: decimal('quantity_kg', { precision: 14, scale: 2 }).notNull(),
  unitValuePkr: decimal('unit_value_pkr', { precision: 12, scale: 2 }),
  storageLocationId: uuid('storage_location_id'),
  disposedOn: date('disposed_on'),
  disposalKind: text('disposal_kind').$type<'sold' | 'fed_livestock' | 'composted' | 'given_away' | 'disposed' | 'still_held'>(),
  proceedsPkr: decimal('proceeds_pkr', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
