/**
 * Context snapshot captured at approval submission time.
 *
 * The Approver PWA shows this snapshot inline so the approver doesn't need
 * to drill into other modules to decide. Snapshots are immutable once
 * persisted — they reflect the state at decision time, not now.
 */

export interface CashPositionSnapshot {
  entityId: string;
  takenAt: string;
  cashOnHandPkr: string;
  bankBalancesPkr: Record<string, string>;
  payableAgingPkr: { current: string; '30d': string; '60d': string; '90dPlus': string };
}

export interface RecentSimilarItem {
  recordId: string;
  occurredAt: string;
  amountPkr: string;
  vendorOrCounterparty: string;
  outcome: 'approved' | 'rejected' | 'executed';
}

export interface InventorySnapshot {
  inputId?: string;
  onHandQty?: string;
  reorderPoint?: string;
  daysOfCover?: number;
}

export interface QuoteComparisonSnapshot {
  repairRequestId: string;
  quotes: Array<{
    quoteId: string;
    workshopName: string;
    totalPkr: string;
    etaDays: number | null;
    warrantyDays: number | null;
    selected: boolean;
    selectionReason: string | null;
  }>;
}

export interface ApprovalContextSnapshot {
  cashPosition?: CashPositionSnapshot;
  recentSimilar?: RecentSimilarItem[];
  inventory?: InventorySnapshot;
  quoteComparison?: QuoteComparisonSnapshot;
  policyThresholdsPkr?: Record<string, number | null>;
  requesterRecentActivity?: Array<{
    occurredAt: string;
    action: string;
    summary: string;
  }>;
  custom?: Record<string, unknown>;
}
