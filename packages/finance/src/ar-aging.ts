import { and, eq, inArray, lte } from 'drizzle-orm';
import { db, arInvoices, buyerCreditLimits } from '@zameen/db';

export type AgeBucket = 'current' | '1-30' | '31-60' | '61-90' | '91-180' | '>180';

export const AGE_BUCKETS: AgeBucket[] = ['current', '1-30', '31-60', '61-90', '91-180', '>180'];

export interface InvoiceAging {
  invoiceId: string;
  invoiceNumber: string;
  buyerId: string;
  invoiceDate: string;
  dueDate: string;
  totalPkr: number;
  paidPkr: number;
  outstandingPkr: number;
  daysSinceDue: number;
  bucket: AgeBucket;
  status: string;
}

export interface BuyerAging {
  buyerId: string;
  buckets: Record<AgeBucket, number>;
  totalOutstandingPkr: number;
  oldestDaysSinceDue: number;
  invoiceCount: number;
  creditLimitPkr: number | null;
  creditUtilizationPct: number | null;
  badDebtProvisionPkr: number;
}

export interface ArAgingReport {
  asOfDate: string;
  entityId: string;
  buyers: BuyerAging[];
  invoices: InvoiceAging[];
  totals: Record<AgeBucket, number>;
  grandTotalOutstandingPkr: number;
  grandTotalBadDebtProvisionPkr: number;
}

function bucketize(daysSinceDue: number): AgeBucket {
  if (daysSinceDue <= 0) return 'current';
  if (daysSinceDue <= 30) return '1-30';
  if (daysSinceDue <= 60) return '31-60';
  if (daysSinceDue <= 90) return '61-90';
  if (daysSinceDue <= 180) return '91-180';
  return '>180';
}

function provisionFactor(daysSinceDue: number): number {
  if (daysSinceDue > 360) return 1.0;
  if (daysSinceDue > 180) return 0.5;
  return 0;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.floor((b - a) / 86_400_000);
}

export interface ComputeArAgingInput {
  entityId: string;
  asOfDate: string;
}

export async function computeArAging(input: ComputeArAgingInput): Promise<ArAgingReport> {
  const { entityId, asOfDate } = input;
  const rows = await db
    .select()
    .from(arInvoices)
    .where(
      and(
        eq(arInvoices.entityId, entityId),
        inArray(arInvoices.status, ['open', 'partial', 'overdue', 'disputed']),
      ),
    );

  const invoices: InvoiceAging[] = rows.map((r) => {
    const days = daysBetween(r.dueDate, asOfDate);
    return {
      invoiceId: r.id,
      invoiceNumber: r.invoiceNumber,
      buyerId: r.buyerId,
      invoiceDate: r.invoiceDate,
      dueDate: r.dueDate,
      totalPkr: Number(r.totalPkr),
      paidPkr: Number(r.paidPkr),
      outstandingPkr: Number(r.outstandingPkr),
      daysSinceDue: days,
      bucket: bucketize(days),
      status: r.status,
    };
  });

  const limits = await db
    .select()
    .from(buyerCreditLimits)
    .where(and(eq(buyerCreditLimits.entityId, entityId), eq(buyerCreditLimits.isActive, true)));
  const limitByBuyer = new Map<string, number>();
  for (const l of limits) {
    if (!l.effectiveTo || l.effectiveTo >= asOfDate) {
      limitByBuyer.set(l.buyerId, Number(l.creditLimitPkr));
    }
  }

  const totals: Record<AgeBucket, number> = {
    current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, '>180': 0,
  };
  const byBuyer = new Map<string, BuyerAging>();

  for (const inv of invoices) {
    totals[inv.bucket] += inv.outstandingPkr;
    let agg = byBuyer.get(inv.buyerId);
    if (!agg) {
      agg = {
        buyerId: inv.buyerId,
        buckets: { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, '>180': 0 },
        totalOutstandingPkr: 0,
        oldestDaysSinceDue: 0,
        invoiceCount: 0,
        creditLimitPkr: limitByBuyer.get(inv.buyerId) ?? null,
        creditUtilizationPct: null,
        badDebtProvisionPkr: 0,
      };
      byBuyer.set(inv.buyerId, agg);
    }
    agg.buckets[inv.bucket] += inv.outstandingPkr;
    agg.totalOutstandingPkr += inv.outstandingPkr;
    agg.oldestDaysSinceDue = Math.max(agg.oldestDaysSinceDue, inv.daysSinceDue);
    agg.invoiceCount += 1;
    agg.badDebtProvisionPkr += inv.outstandingPkr * provisionFactor(inv.daysSinceDue);
  }

  for (const agg of byBuyer.values()) {
    if (agg.creditLimitPkr && agg.creditLimitPkr > 0) {
      agg.creditUtilizationPct = (agg.totalOutstandingPkr / agg.creditLimitPkr) * 100;
    }
  }

  const grandTotalOutstandingPkr = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandTotalBadDebtProvisionPkr = Array.from(byBuyer.values()).reduce(
    (a, b) => a + b.badDebtProvisionPkr,
    0,
  );

  return {
    asOfDate,
    entityId,
    buyers: Array.from(byBuyer.values()).sort((a, b) => b.totalOutstandingPkr - a.totalOutstandingPkr),
    invoices: invoices.sort((a, b) => b.daysSinceDue - a.daysSinceDue),
    totals,
    grandTotalOutstandingPkr,
    grandTotalBadDebtProvisionPkr,
  };
}

export interface CreditCheckResult {
  ok: boolean;
  creditLimitPkr: number | null;
  currentOutstandingPkr: number;
  proposedNewPkr: number;
  projectedOutstandingPkr: number;
  availableHeadroomPkr: number | null;
  reason?: string;
}

export async function checkBuyerCreditAvailability(
  entityId: string,
  buyerId: string,
  proposedNewPkr: number,
  asOfDate: string,
): Promise<CreditCheckResult> {
  const [limit] = await db
    .select()
    .from(buyerCreditLimits)
    .where(
      and(
        eq(buyerCreditLimits.entityId, entityId),
        eq(buyerCreditLimits.buyerId, buyerId),
        eq(buyerCreditLimits.isActive, true),
        lte(buyerCreditLimits.effectiveFrom, asOfDate),
      ),
    )
    .limit(1);

  const open = await db
    .select()
    .from(arInvoices)
    .where(
      and(
        eq(arInvoices.entityId, entityId),
        eq(arInvoices.buyerId, buyerId),
        inArray(arInvoices.status, ['open', 'partial', 'overdue', 'disputed']),
      ),
    );
  const currentOutstandingPkr = open.reduce((a, b) => a + Number(b.outstandingPkr), 0);
  const projectedOutstandingPkr = currentOutstandingPkr + proposedNewPkr;
  const creditLimitPkr = limit ? Number(limit.creditLimitPkr) : null;

  if (creditLimitPkr === null) {
    return {
      ok: true,
      creditLimitPkr: null,
      currentOutstandingPkr,
      proposedNewPkr,
      projectedOutstandingPkr,
      availableHeadroomPkr: null,
      reason: 'no_credit_limit_configured',
    };
  }

  const availableHeadroomPkr = creditLimitPkr - currentOutstandingPkr;
  const ok = projectedOutstandingPkr <= creditLimitPkr;
  return {
    ok,
    creditLimitPkr,
    currentOutstandingPkr,
    proposedNewPkr,
    projectedOutstandingPkr,
    availableHeadroomPkr,
    reason: ok ? undefined : 'credit_limit_exceeded',
  };
}
