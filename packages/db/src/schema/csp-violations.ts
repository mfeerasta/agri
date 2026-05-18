import { integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';

export const cspViolations = zameen.table('csp_violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  app: text('app').notNull(),
  documentUri: text('document_uri'),
  violatedDirective: text('violated_directive'),
  blockedUri: text('blocked_uri'),
  sourceFile: text('source_file'),
  lineNumber: integer('line_number'),
  columnNumber: integer('column_number'),
  userAgent: text('user_agent'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
