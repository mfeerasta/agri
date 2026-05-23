import { bigint, date, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities, users } from './core.js';

export const auditorExportPacks = zameen.table('auditor_export_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  scope: text('scope').notNull().default('full'),
  scopeModules: text('scope_modules').array(),
  status: text('status').notNull().default('building'),
  storagePath: text('storage_path'),
  downloadUrl: text('download_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  downloadCount: integer('download_count').notNull().default(0),
  lastDownloadedAt: timestamp('last_downloaded_at', { withTimezone: true }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  manifestJson: jsonb('manifest_json'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
});

export type AuditorExportPack = typeof auditorExportPacks.$inferSelect;
export type NewAuditorExportPack = typeof auditorExportPacks.$inferInsert;

export const AUDITOR_PACK_SCOPES = ['full', 'financial_only', 'operational_only', 'specific_modules'] as const;
export type AuditorPackScope = (typeof AUDITOR_PACK_SCOPES)[number];

export const AUDITOR_PACK_STATUSES = ['building', 'ready', 'expired', 'revoked', 'failed'] as const;
export type AuditorPackStatus = (typeof AUDITOR_PACK_STATUSES)[number];
