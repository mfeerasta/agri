// auditor-export-pack.ts
//
// Year-end / external-audit evidence pack builder. Assembles statements,
// vouchers, approvals, journal exports, supporting docs, audit trail, and
// policy snapshots into a single ZIP. The output is uploaded to the
// `auditor-packs` Supabase storage bucket and registered in
// `zameen.auditor_export_packs`. The actual ZIP write + upload happens in
// the build-auditor-pack edge function; this module owns the data assembly
// + manifest shape so the edge fn and any local CLI share one source of
// truth.

import { and, between, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@zameen/db';
import {
  approvalActions,
  approvalRequests,
  approvalWorkflows,
  auditorExportPacks,
  entities,
  entityActivity,
  entitySettings,
  type AuditorExportPack,
  type AuditorPackScope,
} from '@zameen/db';

export interface BuildExportPackInput {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  requestedBy: string;
  scope?: AuditorPackScope;
  scopeModules?: string[];
}

export interface ExportPackManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
  rowCount?: number;
  description?: string;
}

export interface ExportPackManifest {
  packId: string;
  entityId: string;
  entityName: string;
  entityNtn?: string | null;
  periodStart: string;
  periodEnd: string;
  scope: AuditorPackScope;
  scopeModules?: string[];
  generatedAt: string;
  generatedBy: string;
  fileCount: number;
  totalBytes: number;
  files: ExportPackManifestEntry[];
  policySnapshot: {
    approvalWorkflows: number;
    entitySettings: unknown;
  };
  warnings: string[];
}

export interface ExportPackSections {
  statements: PackFile[];
  vouchers: PackFile[];
  approvalsJson: PackFile;
  approvalsCsv: PackFile;
  journals: PackFile;
  supportingDocs: PackFile;
  auditTrail: PackFile;
  policies: PackFile;
}

export interface PackFile {
  path: string;
  bytes: Uint8Array;
  description?: string;
  rowCount?: number;
}

/**
 * Creates a `building` row immediately so the UI can show progress.
 * The edge function then takes over: assembles content, uploads ZIP,
 * updates the row to `ready` with manifest + signed URL.
 */
export async function registerExportPack(
  input: BuildExportPackInput,
): Promise<AuditorExportPack> {
  const [row] = await db
    .insert(auditorExportPacks)
    .values({
      entityId: input.entityId,
      requestedBy: input.requestedBy,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      scope: input.scope ?? 'full',
      scopeModules: input.scopeModules ?? null,
      status: 'building',
    })
    .returning();
  return row;
}

/**
 * Pure data assembly. The edge function passes this to a ZIP writer + upload.
 * Splitting at this seam keeps the Node + Deno code paths in sync.
 */
export interface CollectedPeriodData {
  entity: { id: string; name: string; ntn: string | null };
  settings: unknown;
  workflows: unknown[];
  approvals: ApprovalSummary[];
  approvalActionsRows: unknown[];
  activity: unknown[];
  vouchers: VoucherRef[];
  journalLineCount: number;
  supportingDocs: SupportingDocRef[];
}

export interface ApprovalSummary {
  id: string;
  approvalType: string;
  state: string;
  amountPkr: string | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  requestedBy: string;
  title: string;
}

export interface VoucherRef {
  kind: 'cash_receipt' | 'cash_payment' | 'journal' | 'payslip' | 'mandi_patti' | 'grn';
  number: string;
  date: string;
  sourceRecordId: string;
  amountPkr: string;
}

export interface SupportingDocRef {
  module: string;
  recordId: string;
  fileUrl: string;
  mimeType?: string | null;
  uploadedAt?: Date | null;
}

export async function collectPeriodData(input: BuildExportPackInput): Promise<CollectedPeriodData> {
  const { entityId, periodStart, periodEnd } = input;

  const [ent] = await db
    .select({ id: entities.id, name: entities.name, ntn: entities.ntn })
    .from(entities)
    .where(eq(entities.id, entityId));
  if (!ent) throw new Error(`Entity ${entityId} not found`);

  const [settings] = await db
    .select()
    .from(entitySettings)
    .where(eq(entitySettings.entityId, entityId));

  const workflows = await db
    .select()
    .from(approvalWorkflows)
    .where(eq(approvalWorkflows.entityId, entityId));

  const approvals = await db
    .select({
      id: approvalRequests.id,
      approvalType: approvalRequests.approvalType,
      state: approvalRequests.state,
      amountPkr: approvalRequests.amountPkr,
      submittedAt: approvalRequests.submittedAt,
      decidedAt: approvalRequests.decidedAt,
      requestedBy: approvalRequests.requestedBy,
      title: approvalRequests.title,
    })
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityId, entityId),
        gte(approvalRequests.createdAt, new Date(periodStart)),
        lte(approvalRequests.createdAt, new Date(`${periodEnd}T23:59:59Z`)),
      ),
    );

  const approvalIds = approvals.map((a) => a.id);
  const actionsRows = approvalIds.length
    ? await db
        .select()
        .from(approvalActions)
        .where(sql`${approvalActions.approvalRequestId} = any(${approvalIds})`)
    : [];

  const activity = await db
    .select()
    .from(entityActivity)
    .where(
      and(
        between(
          entityActivity.occurredAt,
          new Date(periodStart),
          new Date(`${periodEnd}T23:59:59Z`),
        ),
        sql`${entityActivity.payload}->>'entityId' = ${entityId} or ${entityActivity.entityKind} = 'entity'`,
      ),
    );

  // Vouchers + journal lines + supporting docs are pulled by the edge fn
  // via raw queries against module-specific tables so this module can stay
  // strictly drizzle-typed. We expose empty arrays here as the contract;
  // the edge fn fills them in.
  return {
    entity: ent,
    settings: settings ?? null,
    workflows,
    approvals: approvals as ApprovalSummary[],
    approvalActionsRows: actionsRows,
    activity,
    vouchers: [],
    journalLineCount: 0,
    supportingDocs: [],
  };
}

export function buildManifest(
  packRow: AuditorExportPack,
  data: CollectedPeriodData,
  files: ExportPackManifestEntry[],
): ExportPackManifest {
  return {
    packId: packRow.id,
    entityId: data.entity.id,
    entityName: data.entity.name,
    entityNtn: data.entity.ntn,
    periodStart: packRow.periodStart,
    periodEnd: packRow.periodEnd,
    scope: packRow.scope as AuditorPackScope,
    scopeModules: packRow.scopeModules ?? undefined,
    generatedAt: new Date().toISOString(),
    generatedBy: packRow.requestedBy,
    fileCount: files.length,
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    files,
    policySnapshot: {
      approvalWorkflows: data.workflows.length,
      entitySettings: data.settings,
    },
    warnings: [],
  };
}

/**
 * Top-level orchestrator usable from Node (CLI / scripts). The Supabase
 * edge function calls `registerExportPack` + invokes itself asynchronously
 * for the heavy lifting. This Node-side path is intended for local
 * regeneration / dev only.
 */
export async function buildExportPack(input: BuildExportPackInput): Promise<AuditorExportPack> {
  const pack = await registerExportPack(input);
  // Real ZIP write happens in the edge function. Node-side we leave the
  // row in `building` and let the cron / direct invoke pick it up.
  return pack;
}

export const SCOPE_MODULES = {
  financial_only: ['statements', 'vouchers', 'journals', 'approvals'],
  operational_only: ['mandi_dispatches', 'harvest_records', 'diesel_logs', 'repairs'],
} as const;
