import { decimal, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';
import { fields } from './land.js';

// AI farm assistant: conversations, per-message audit, and cross-module
// recommendations. See supabase/migrations/0085_ai_assistant.sql for the
// authoritative DDL including RLS and check constraints.

export type AssistantChannel = 'web' | 'field_pwa' | 'whatsapp' | 'ops_pwa';
export type AssistantRole = 'user' | 'assistant' | 'tool' | 'system';
export type RecommendationCategory =
  | 'irrigation'
  | 'spray'
  | 'fertilizer'
  | 'harvest'
  | 'maintenance'
  | 'inventory'
  | 'financial'
  | 'staffing'
  | 'weather'
  | 'compliance';
export type RecommendationPriority = 'low' | 'medium' | 'high' | 'urgent';

export const assistantConversations = zameen.table('assistant_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  channel: text('channel').$type<AssistantChannel>().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  title: text('title'),
  contextSnapshot: jsonb('context_snapshot').$type<Record<string, unknown> | null>(),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalCostUsd: decimal('total_cost_usd', { precision: 10, scale: 4 }).notNull().default('0'),
});

export const assistantMessages = zameen.table('assistant_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => assistantConversations.id, { onDelete: 'cascade' }),
  role: text('role').$type<AssistantRole>().notNull(),
  content: text('content').notNull(),
  contentUr: text('content_ur'),
  voiceUrl: text('voice_url'),
  toolCalls: jsonb('tool_calls').$type<unknown>(),
  toolResults: jsonb('tool_results').$type<unknown>(),
  citations: jsonb('citations').$type<unknown>(),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  cachedTokens: integer('cached_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const assistantRecommendations = zameen.table('assistant_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  category: text('category').$type<RecommendationCategory>().notNull(),
  priority: text('priority').$type<RecommendationPriority>().notNull(),
  fieldId: uuid('field_id').references(() => fields.id),
  title: text('title').notNull(),
  titleUr: text('title_ur'),
  rationale: text('rationale').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  relatedData: jsonb('related_data').$type<Record<string, unknown> | null>(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  actedOnAt: timestamp('acted_on_at', { withTimezone: true }),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  dismissReason: text('dismiss_reason'),
});
