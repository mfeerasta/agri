import { boolean, date, decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { workers } from './labor.js';

export const workerScorePeriods = zameen.table('worker_score_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  daysPresent: integer('days_present').notNull().default(0),
  daysAbsent: integer('days_absent').notNull().default(0),
  daysLate: integer('days_late').notNull().default(0),
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  tasksLate: integer('tasks_late').notNull().default(0),
  pieceRateUnits: decimal('piece_rate_units', { precision: 14, scale: 4 }).notNull().default('0'),
  pieceRateTotalPkr: decimal('piece_rate_total_pkr', { precision: 14, scale: 2 }).notNull().default('0'),
  dieselAnomaliesAssociated: integer('diesel_anomalies_associated').notNull().default(0),
  compositeScore: decimal('composite_score', { precision: 8, scale: 4 }).notNull().default('0'),
  rankInPeriod: integer('rank_in_period'),
  bonusEligible: boolean('bonus_eligible').notNull().default(false),
  bonusAmountPkr: decimal('bonus_amount_pkr', { precision: 14, scale: 2 }).default('0'),
  bonusPayslipId: uuid('bonus_payslip_id'),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BonusPeriodKind = 'weekly' | 'monthly' | 'seasonal' | 'annual';
export type BonusAmountKind = 'flat' | 'percent_of_base' | 'percent_of_piece_rate' | 'top_n';

export interface BonusRuleFormula {
  minDaysPresent?: number;
  maxDaysLate?: number;
  maxTasksLate?: number;
  maxDieselAnomalies?: number;
  minTasksCompleted?: number;
  minPieceRateUnits?: number;
}

export const bonusRules = zameen.table('bonus_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  periodKind: text('period_kind').notNull().default('monthly'),
  formula: jsonb('formula').$type<BonusRuleFormula>().notNull(),
  minScore: decimal('min_score', { precision: 8, scale: 4 }).notNull().default('0'),
  amountKind: text('amount_kind').notNull().default('flat'),
  amountValue: decimal('amount_value', { precision: 14, scale: 2 }).notNull(),
  topN: integer('top_n'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
