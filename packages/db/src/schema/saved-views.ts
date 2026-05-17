import { boolean, jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export type SavedViewMode = 'table' | 'kanban' | 'gantt' | 'calendar' | 'workload' | 'chart' | 'map';

export const savedViews = zameen.table('saved_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 32 }).notNull(),
  name: text('name').notNull(),
  viewMode: varchar('view_mode', { length: 16 }).$type<SavedViewMode>().notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  shared: boolean('shared').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
