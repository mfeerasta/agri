import { date, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';

/**
 * External crop advisories (PARC, FAO Pakistan, others). Manually uploaded
 * by admins; AI-extracted summaries surfaced contextually on crop plan pages.
 */
export const externalAdvisories = zameen.table('external_advisories', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  title: text('title').notNull(),
  publishedOn: date('published_on').notNull(),
  region: text('region'),
  commodities: text('commodities').array().notNull().default([] as unknown as string[]),
  pdfUrl: text('pdf_url'),
  aiSummary: text('ai_summary'),
  aiSummaryUr: text('ai_summary_ur'),
  keyRecommendations: jsonb('key_recommendations').notNull().default([] as unknown as object),
  ingestedBy: uuid('ingested_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExternalAdvisory = typeof externalAdvisories.$inferSelect;
export type NewExternalAdvisory = typeof externalAdvisories.$inferInsert;
