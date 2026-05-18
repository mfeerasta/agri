import { boolean, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entityKindEnum, userRoleEnum } from './enums.js';

export const entities = zameen.table('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 16 }).notNull().unique(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  kind: entityKindEnum('kind').notNull().default('proprietorship'),
  ntn: varchar('ntn', { length: 32 }),
  strn: varchar('strn', { length: 32 }),
  registeredAddress: text('registered_address'),
  approvalThresholds: jsonb('approval_thresholds').notNull().default({}),
  settings: jsonb('settings').notNull().default({}),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const users = zameen.table('users', {
  id: uuid('id').primaryKey(),
  authUserId: uuid('auth_user_id').unique(),
  haazriWorkerId: uuid('haazri_worker_id'),
  fullName: text('full_name').notNull(),
  fullNameUr: text('full_name_ur'),
  phone: varchar('phone', { length: 24 }).unique(),
  email: varchar('email', { length: 256 }),
  cnicEncrypted: text('cnic_encrypted'),
  cnicLast4: varchar('cnic_last4', { length: 4 }),
  primaryRole: userRoleEnum('primary_role').notNull().default('worker'),
  defaultEntityId: uuid('default_entity_id').references(() => entities.id, { onDelete: 'set null' }),
  preferredLocale: varchar('preferred_locale', { length: 8 }).notNull().default('ur'),
  notificationPrefs: jsonb('notification_prefs').notNull().default({}),
  toursCompleted: jsonb('tours_completed').notNull().default([]).$type<string[]>(),
  toursSkipped: jsonb('tours_skipped').notNull().default([]).$type<string[]>(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userEntityRoles = zameen.table('user_entity_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull(),
  approvalLimits: jsonb('approval_limits').notNull().default({}),
  delegateUserId: uuid('delegate_user_id').references(() => users.id),
  delegationStart: timestamp('delegation_start', { withTimezone: true }),
  delegationEnd: timestamp('delegation_end', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = zameen.table('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRoleEnum('role').notNull(),
  resource: varchar('resource', { length: 64 }).notNull(),
  actions: jsonb('actions').notNull().$type<string[]>(),
  conditions: jsonb('conditions'),
});

export const entitySettings = zameen.table('entity_settings', {
  entityId: uuid('entity_id').primaryKey().references(() => entities.id, { onDelete: 'cascade' }),
  fiscalYearStartMonth: varchar('fiscal_year_start_month', { length: 2 }).notNull().default('07'),
  defaultLocale: varchar('default_locale', { length: 8 }).notNull().default('ur'),
  unitsConfig: jsonb('units_config').notNull().default({}),
  approvalThresholds: jsonb('approval_thresholds').notNull().default({}),
  emergencyApprovalGraceHours: varchar('emergency_grace_hours', { length: 4 }).notNull().default('48'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
