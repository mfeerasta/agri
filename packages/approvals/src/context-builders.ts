/**
 * Per-module context-snapshot builders. Called at approval submission time;
 * snapshots are frozen in approvalRequests.contextSnapshot JSONB and never
 * recomputed. Approver PWA reads the snapshot to render decision context.
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  accounts,
  journalLines,
  journalEntries,
  approvalRequests,
  purchaseInvoices,
  inputs,
  inputPurchases,
  inputIssuances,
  repairQuotes,
  entitySettings,
  auditLog,
} from '@zameen/db';
import type { ApprovalType } from '@zameen/shared';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import type {
  ApprovalContextSnapshot,
  CashPositionSnapshot,
  InventorySnapshot,
  QuoteComparisonSnapshot,
  RecentSimilarItem,
} from './context.js';

const CASH_CODE = '1000';
const BANK_CODES = ['1010'];

/** Compute cash on hand + bank balances + payable aging buckets for an entity. */
export async function buildCashPosition(entityId: string): Promise<CashPositionSnapshot> {
  const entityAccounts = await db.select().from(accounts).where(eq(accounts.entityId, entityId));
  const cashAcc = entityAccounts.find((a) => a.code === CASH_CODE);
  const bankAccs = entityAccounts.filter((a) => BANK_CODES.includes(a.code));

  async function balanceFor(accountId: string): Promise<number> {
    const rows = await db
      .select({
        debit: sql<string>`coalesce(sum(${journalLines.debitPkr}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.creditPkr}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalLines.accountId, accountId), eq(journalEntries.entityId, entityId)));
    const r = rows[0];
    return Number(r?.debit ?? 0) - Number(r?.credit ?? 0);
  }

  const cashOnHand = cashAcc ? await balanceFor(cashAcc.id) : 0;
  const bankBalances: Record<string, string> = {};
  for (const b of bankAccs) {
    bankBalances[b.name] = (await balanceFor(b.id)).toFixed(2);
  }

  const openInvoices = await db
    .select()
    .from(purchaseInvoices)
    .where(and(eq(purchaseInvoices.entityId, entityId), eq(purchaseInvoices.status, 'open')));
  const today = new Date();
  const buckets = { current: 0, '30d': 0, '60d': 0, '90dPlus': 0 };
  for (const inv of openInvoices) {
    const outstanding = Number(inv.totalPkr) - Number(inv.paidPkr);
    if (outstanding <= 0) continue;
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    const daysOverdue = due ? Math.floor((today.getTime() - due.getTime()) / 86_400_000) : 0;
    if (daysOverdue <= 0) buckets.current += outstanding;
    else if (daysOverdue <= 30) buckets['30d'] += outstanding;
    else if (daysOverdue <= 60) buckets['60d'] += outstanding;
    else buckets['90dPlus'] += outstanding;
  }

  return {
    entityId,
    takenAt: new Date().toISOString(),
    cashOnHandPkr: cashOnHand.toFixed(2),
    bankBalancesPkr: bankBalances,
    payableAgingPkr: {
      current: buckets.current.toFixed(2),
      '30d': buckets['30d'].toFixed(2),
      '60d': buckets['60d'].toFixed(2),
      '90dPlus': buckets['90dPlus'].toFixed(2),
    },
  };
}

export interface RecentSimilarArgs {
  entityId: string;
  approvalType: ApprovalType;
  vendorOrCounterparty?: string;
  limit?: number;
}

/** Return up to N recently decided approvals of the same type for context. */
export async function buildRecentSimilar(args: RecentSimilarArgs): Promise<RecentSimilarItem[]> {
  const limit = args.limit ?? 3;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const rows = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.entityId, args.entityId),
        eq(approvalRequests.approvalType, args.approvalType),
        gte(approvalRequests.decidedAt, ninetyDaysAgo),
      ),
    )
    .orderBy(desc(approvalRequests.decidedAt))
    .limit(limit * 4);

  const filtered = args.vendorOrCounterparty
    ? rows.filter((r) => {
        const p = (r.payload ?? {}) as Record<string, unknown>;
        const v = (p.vendorName ?? p.workshopName ?? p.buyer ?? p.taxKind) as string | undefined;
        return v ? v.toLowerCase().includes(args.vendorOrCounterparty!.toLowerCase()) : false;
      })
    : rows;

  return filtered.slice(0, limit).map((r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const counterparty =
      (p.vendorName as string | undefined) ??
      (p.workshopName as string | undefined) ??
      (p.buyer as string | undefined) ??
      (p.taxKind as string | undefined) ??
      '';
    const outcome: RecentSimilarItem['outcome'] =
      r.state === 'rejected' ? 'rejected' : r.state === 'executed' ? 'executed' : 'approved';
    return {
      recordId: r.id,
      occurredAt: (r.decidedAt ?? r.createdAt).toISOString(),
      amountPkr: r.amountPkr ?? '0',
      vendorOrCounterparty: counterparty,
      outcome,
    };
  });
}

/** Inventory on-hand + days-of-cover + reorder point for one input. */
export async function buildInventorySnapshot(args: {
  entityId: string;
  inputId: string;
}): Promise<InventorySnapshot> {
  const [inputRow] = await db.select().from(inputs).where(eq(inputs.id, args.inputId)).limit(1);
  if (!inputRow) return { inputId: args.inputId };

  const purchases = await db
    .select({ q: sql<string>`coalesce(sum(${inputPurchases.quantity}), 0)` })
    .from(inputPurchases)
    .where(eq(inputPurchases.inputId, args.inputId));
  const issuances = await db
    .select({ q: sql<string>`coalesce(sum(${inputIssuances.quantity}), 0)` })
    .from(inputIssuances)
    .where(eq(inputIssuances.inputId, args.inputId));
  const onHand = Number(purchases[0]?.q ?? 0) - Number(issuances[0]?.q ?? 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const recent = await db
    .select({ q: sql<string>`coalesce(sum(${inputIssuances.quantity}), 0)` })
    .from(inputIssuances)
    .where(and(eq(inputIssuances.inputId, args.inputId), gte(inputIssuances.issuedOn, thirtyDaysAgo)));
  const dailyBurn = Number(recent[0]?.q ?? 0) / 30;
  const daysOfCover = dailyBurn > 0 ? Math.floor(onHand / dailyBurn) : undefined;

  return {
    inputId: args.inputId,
    onHandQty: onHand.toFixed(4),
    reorderPoint: inputRow.reorderPoint ?? undefined,
    daysOfCover,
  };
}

/** All repair quotes for a request with selected flag and reason. */
export async function buildQuoteComparison(repairRequestId: string): Promise<QuoteComparisonSnapshot> {
  const quotes = await db
    .select()
    .from(repairQuotes)
    .where(eq(repairQuotes.repairRequestId, repairRequestId));
  return {
    repairRequestId,
    quotes: quotes.map((q) => ({
      quoteId: q.id,
      workshopName: q.workshopName,
      totalPkr: q.totalQuotePkr,
      etaDays: q.etaDays ? Number(q.etaDays) : null,
      warrantyDays: q.warrantyDays ? Number(q.warrantyDays) : null,
      selected: q.selected,
      selectionReason: q.selectionReason ?? null,
    })),
  };
}

/** Read entity-level thresholds for one approval type, falling back to defaults. */
export async function buildPolicyThresholds(args: {
  entityId: string;
  approvalType: ApprovalType;
}): Promise<Record<string, number | null>> {
  const [s] = await db
    .select()
    .from(entitySettings)
    .where(eq(entitySettings.entityId, args.entityId))
    .limit(1);
  const stored = (s?.approvalThresholds ?? {}) as Record<string, Record<string, number | null>>;
  const tier = stored[args.approvalType] ?? DEFAULT_APPROVAL_THRESHOLDS_PKR[args.approvalType];
  return {
    supervisor: tier.supervisor ?? null,
    farm_manager: tier.farm_manager ?? null,
    director: tier.director ?? null,
  };
}

/** Recent audit log rows for the requester to give the approver behavioural context. */
export async function buildRequesterRecentActivity(args: {
  userId: string;
  entityId: string;
  limit?: number;
}): Promise<Array<{ occurredAt: string; action: string; summary: string }>> {
  const limit = args.limit ?? 5;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.actorId, args.userId),
        eq(auditLog.entityId, args.entityId),
        gte(auditLog.occurredAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(auditLog.occurredAt))
    .limit(limit);
  return rows.map((r) => ({
    occurredAt: r.occurredAt.toISOString(),
    action: r.action,
    summary: `${r.action} on ${r.resource}${r.resourceId ? ` ${r.resourceId.slice(0, 8)}` : ''}`,
  }));
}

export interface FullContextArgs {
  entityId: string;
  approvalType: ApprovalType;
  payload: Record<string, unknown>;
  requesterUserId: string;
  sourceModule: string;
}

/** Aggregate snapshot: always-on slices plus module-conditional inventory and quote comparison. */
export async function buildFullContext(args: FullContextArgs): Promise<ApprovalContextSnapshot> {
  const vendorOrCounterparty =
    (args.payload.vendorName as string | undefined) ??
    (args.payload.workshopName as string | undefined) ??
    (args.payload.buyer as string | undefined) ??
    (args.payload.taxKind as string | undefined);

  const [cashPosition, recentSimilar, policyThresholdsPkr, requesterRecentActivity] = await Promise.all([
    buildCashPosition(args.entityId),
    buildRecentSimilar({ entityId: args.entityId, approvalType: args.approvalType, vendorOrCounterparty }),
    buildPolicyThresholds({ entityId: args.entityId, approvalType: args.approvalType }),
    buildRequesterRecentActivity({ userId: args.requesterUserId, entityId: args.entityId }),
  ]);

  const snapshot: ApprovalContextSnapshot = {
    cashPosition,
    recentSimilar,
    policyThresholdsPkr,
    requesterRecentActivity,
  };

  const inputId = args.payload.inputId as string | undefined;
  if (inputId) {
    snapshot.inventory = await buildInventorySnapshot({ entityId: args.entityId, inputId });
  }

  if (args.sourceModule === 'repair') {
    const repairRequestId = (args.payload.repairRequestId as string | undefined) ?? undefined;
    if (repairRequestId) {
      snapshot.quoteComparison = await buildQuoteComparison(repairRequestId);
    }
  }

  return snapshot;
}
