import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { users } from './core.js';

export const whatsappInboundMessages = zameen.table('whatsapp_inbound_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  metaMessageId: text('meta_message_id').notNull().unique(),
  fromPhone: text('from_phone').notNull(),
  body: text('body'),
  mediaUrl: text('media_url'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  matchedUserId: uuid('matched_user_id').references(() => users.id),
  nluIntent: text('nlu_intent'),
  nluPayload: jsonb('nlu_payload'),
  replySentAt: timestamp('reply_sent_at', { withTimezone: true }),
});
