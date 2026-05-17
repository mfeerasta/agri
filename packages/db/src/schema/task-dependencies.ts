import { timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { tasks } from './labor.js';

// Composite unique (blocker_task_id, blocked_task_id) is enforced by the
// SQL migration (0013). Keeping the Drizzle definition minimal avoids
// the typed-builder hoop with composite uniques.
export const taskDependencies = zameen.table('task_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  blockerTaskId: uuid('blocker_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  blockedTaskId: uuid('blocked_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 24 }).notNull().default('finish_to_start'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TaskDependencyKind =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';
