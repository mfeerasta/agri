import { decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const feasibilityPlans = zameen.table('feasibility_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  season: text('season'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface FeasibilityCostBreakdown {
  seed?: number;
  fertilizer?: number;
  pesticide?: number;
  irrigation?: number;
  labour?: number;
  diesel?: number;
  repair?: number;
  other?: number;
}

export const feasibilityPlanScenarios = zameen.table('feasibility_plan_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => feasibilityPlans.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cropCode: text('crop_code').notNull(),
  fieldIds: jsonb('field_ids').$type<string[]>().notNull().default([]),
  totalAcres: decimal('total_acres', { precision: 12, scale: 4 }).notNull(),
  yieldPerAcreKg: decimal('yield_per_acre_kg', { precision: 14, scale: 2 }).notNull(),
  pricePerKgPkr: decimal('price_per_kg_pkr', { precision: 14, scale: 2 }).notNull(),
  costBreakdown: jsonb('cost_breakdown').$type<FeasibilityCostBreakdown>().notNull().default({}),
  revenuePkr: decimal('revenue_pkr', { precision: 14, scale: 2 }).notNull(),
  totalCostPkr: decimal('total_cost_pkr', { precision: 14, scale: 2 }).notNull(),
  netPkr: decimal('net_pkr', { precision: 14, scale: 2 }).notNull(),
  netPerAcrePkr: decimal('net_per_acre_pkr', { precision: 14, scale: 2 }).notNull(),
  irrPct: decimal('irr_pct', { precision: 6, scale: 3 }),
  paybackMonths: decimal('payback_months', { precision: 6, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
