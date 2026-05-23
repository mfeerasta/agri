import { boolean, date, decimal, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { workers } from './labor.js';

export interface PerformanceBonusRules {
  attendanceBonusPctOver90?: number;
  harvestBonusPerKg?: number;
  noBreakdownBonusPkr?: number;
  taskCompletionBonusPctOnTime?: number;
}

export const bonusRuleSets = zameen.table('bonus_rule_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  rules: jsonb('rules').$type<PerformanceBonusRules>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface WorkerBonusBreakdown {
  attendanceBonusPkr: number;
  harvestBonusPkr: number;
  noBreakdownBonusPkr: number;
  taskCompletionBonusPkr: number;
  attendancePct: number;
  harvestKg: number;
  breakdownEvents: number;
  taskOnTimePct: number;
}

export const workerBonusAwards = zameen.table('worker_bonus_awards', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  ruleSetId: uuid('rule_set_id').notNull().references(() => bonusRuleSets.id),
  baseSalaryPkr: decimal('base_salary_pkr', { precision: 14, scale: 2 }).notNull(),
  bonusBreakdown: jsonb('bonus_breakdown').$type<WorkerBonusBreakdown>().notNull(),
  totalBonusPkr: decimal('total_bonus_pkr', { precision: 14, scale: 2 }).notNull(),
  awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
  approvalRequestId: uuid('approval_request_id'),
  paidInPayrollRunId: uuid('paid_in_payroll_run_id'),
});
