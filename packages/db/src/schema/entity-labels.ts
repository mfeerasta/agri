import { text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

export type LabelScope = 'task' | 'crop_plan' | 'repair' | 'approval';

// Composite unique (scope, name) is enforced by the SQL migration (0013).
export const entityLabels = zameen.table('entity_labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityIdText: text('entity_id_text').notNull(),
  scope: varchar('scope', { length: 16 }).$type<LabelScope>().notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
