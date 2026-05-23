import { decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

export interface RotationScheduleEntry {
  year: number;
  cropCode: string;
  season?: 'rabi' | 'kharif' | 'zaid';
  notes?: string;
}

export interface ScenarioYearOutput {
  year: number;
  revenuePkr: number;
  opexPkr: number;
  capexPkr: number;
  financingPkr: number;
  netCashFlowPkr: number;
  cumulativeCashPkr: number;
}

export interface MonteCarloPercentiles {
  p5: number[];
  p50: number[];
  p95: number[];
  npvP5: number;
  npvP50: number;
  npvP95: number;
}

export const strategicPlans = zameen.table('strategic_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  horizonYears: integer('horizon_years').notNull().default(5),
  startYear: integer('start_year').notNull(),
  createdBy: uuid('created_by').notNull(),
  visionStatement: text('vision_statement'),
  currentStateSnapshot: jsonb('current_state_snapshot'),
  targetStateSnapshot: jsonb('target_state_snapshot'),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const strategicInitiatives = zameen.table('strategic_initiatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => strategicPlans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  startYear: integer('start_year').notNull(),
  endYear: integer('end_year').notNull(),
  estimatedInvestmentPkr: decimal('estimated_investment_pkr', { precision: 14, scale: 2 }),
  expectedReturnPkr: decimal('expected_return_pkr', { precision: 14, scale: 2 }),
  expectedIrrPct: decimal('expected_irr_pct', { precision: 6, scale: 3 }),
  paybackYears: decimal('payback_years', { precision: 5, scale: 2 }),
  priority: text('priority').notNull(),
  riskFactors: jsonb('risk_factors'),
  dependencies: jsonb('dependencies').$type<string[]>(),
  status: text('status').notNull().default('proposed'),
  approvalRequestId: uuid('approval_request_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cropRotationPlans = zameen.table('crop_rotation_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => strategicPlans.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id')
    .notNull()
    .references(() => fields.id),
  rotationSchedule: jsonb('rotation_schedule').$type<RotationScheduleEntry[]>().notNull(),
  rotationKind: text('rotation_kind'),
  rotationPrinciples: jsonb('rotation_principles').$type<string[]>(),
  expectedSoilImpact: text('expected_soil_impact'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scenarioSimulations = zameen.table('scenario_simulations', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => strategicPlans.id, { onDelete: 'cascade' }),
  scenarioName: text('scenario_name').notNull(),
  baseYear: integer('base_year').notNull(),
  horizonYears: integer('horizon_years').notNull(),
  inputsJsonb: jsonb('inputs_jsonb').notNull(),
  outputsJsonb: jsonb('outputs_jsonb').$type<ScenarioYearOutput[]>().notNull(),
  netPresentValuePkr: decimal('net_present_value_pkr', { precision: 14, scale: 2 }),
  internalRateOfReturnPct: decimal('internal_rate_of_return_pct', { precision: 6, scale: 3 }),
  paybackYears: decimal('payback_years', { precision: 5, scale: 2 }),
  monteCarloIterations: integer('monte_carlo_iterations'),
  monteCarloResults: jsonb('monte_carlo_results').$type<MonteCarloPercentiles>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
