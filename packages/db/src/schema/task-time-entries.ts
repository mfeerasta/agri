import { integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { tasks } from './labor.js';
import { workers } from './labor.js';

export const taskTimeEntries = zameen.table('task_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  workerId: uuid('worker_id').notNull().references(() => workers.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
