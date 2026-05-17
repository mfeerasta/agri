import { boolean, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';

export const automationRecipes = zameen.table('automation_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  triggerKind: text('trigger_kind').notNull(),
  triggerConfig: jsonb('trigger_config').notNull().default({}),
  conditions: jsonb('conditions').notNull().default([]),
  actions: jsonb('actions').notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  fireCount: integer('fire_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const automationRuns = zameen.table('automation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => automationRecipes.id, { onDelete: 'cascade' }),
  triggeredBy: jsonb('triggered_by'),
  actionsExecuted: jsonb('actions_executed').notNull().default([]),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userDashboards = zameen.table('user_dashboards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  widgets: jsonb('widgets').notNull().default([]),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
