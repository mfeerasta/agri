import { jsonb, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export interface ChannelsEnabled {
  in_app: boolean;
  whatsapp: boolean;
  email: boolean;
  push: boolean;
}

export const notificationPreferences = zameen.table('notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  channelsEnabled: jsonb('channels_enabled').$type<ChannelsEnabled>().notNull(),
  kindsDisabled: text('kinds_disabled').array().notNull(),
  quietHoursStart: time('quiet_hours_start'),
  quietHoursEnd: time('quiet_hours_end'),
  digestMode: text('digest_mode').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NotificationPreferenceInsert = typeof notificationPreferences.$inferInsert;

export type DigestMode = 'instant' | 'hourly' | 'daily_morning' | 'daily_evening';
