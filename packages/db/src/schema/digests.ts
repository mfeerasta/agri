import { boolean, jsonb, text, time, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';

export const digestSubscriptions = zameen.table('digest_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  target: text('target').notNull(),
  kind: text('kind').notNull(),
  sendTimeLocal: time('send_time_local').notNull().default('07:00'),
  timezone: text('timezone').notNull().default('Asia/Karachi'),
  enabled: boolean('enabled').notNull().default(true),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  customFilters: jsonb('custom_filters').notNull().default({}),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const onboardingDrafts = zameen.table('onboarding_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  state: jsonb('state').notNull().default({}),
  step: integer('step').notNull().default(1),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DigestChannel = 'slack' | 'email' | 'whatsapp';
export type DigestKind = 'daily' | 'weekly' | 'monthly';
