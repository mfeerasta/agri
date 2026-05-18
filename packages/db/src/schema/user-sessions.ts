import { text, timestamp, uuid, varchar, index } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export const userSessions = zameen.table(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sessionTokenHash: text('session_token_hash').notNull(),
    deviceLabel: text('device_label'),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    app: varchar('app', { length: 16 }).notNull(),
    city: text('city'),
    country: text('country'),
    signedInAt: timestamp('signed_in_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    byUser: index('idx-sessions-user').on(t.userId, t.signedInAt),
    byToken: index('idx-sessions-token').on(t.sessionTokenHash),
  }),
);

export type UserSession = typeof userSessions.$inferSelect;
export type UserSessionInsert = typeof userSessions.$inferInsert;
