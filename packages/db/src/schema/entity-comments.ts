import { jsonb, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export type CommentEntityKind = 'task' | 'approval' | 'repair' | 'crop_plan' | 'feasibility';

export const entityComments = zameen.table('entity_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityKind: varchar('entity_kind', { length: 16 }).$type<CommentEntityKind>().notNull(),
  entityId: uuid('entity_id').notNull(),
  parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => entityComments.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  bodyUr: text('body_ur'),
  mentions: uuid('mentions').array().notNull().default([]),
  attachments: jsonb('attachments').$type<Array<{ url: string; name?: string; mimeType?: string }>>().notNull().default([]),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
