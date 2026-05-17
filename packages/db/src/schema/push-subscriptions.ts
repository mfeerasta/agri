import { integer, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export const pushSubscriptions = zameen.table('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  deviceLabel: text('device_label'),
  app: varchar('app', { length: 16 }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  failureCount: integer('failure_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type PushSubscriptionInsert = typeof pushSubscriptions.$inferInsert;
