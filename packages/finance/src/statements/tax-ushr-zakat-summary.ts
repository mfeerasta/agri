// Period roll-up summary: tax periods + ushr settlements + zakat assessments
// over a date range. Used by the Finance statements panel.

import { db, taxPeriods, ushrSettlements, zakatAssessments, TAX_KIND_LABELS, type TaxKind } from '@zameen/db';
import { and, between, gte, lte, eq } from 'drizzle-orm';

export interface TaxUshrZakatSummaryRow {
  taxKind: TaxKind | 'ushr_kind' | 'zakat_kind';
  label: string;
  count: number;
  computedPkr: number;
  paidPkr: number;
}

export interface TaxUshrZakatSummary {
  rangeStart: string;
  rangeEnd: string;
  rows: TaxUshrZakatSummaryRow[];
  totalComputedPkr: number;
  totalPaidPkr: number;
  ushrTotalKg: number;
  ushrTotalValuePkr: number;
}

export async function computeTaxUshrZakatSummary(
  entityId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<TaxUshrZakatSummary> {
  const periods = await db.select().from(taxPeriods).where(
    and(eq(taxPeriods.entityId, entityId), between(taxPeriods.periodEnd, rangeStart, rangeEnd)),
  );
  const grouped = new Map<string, TaxUshrZakatSummaryRow>();
  for (const p of periods) {
    const kind = p.taxKind as TaxKind;
    const r = grouped.get(kind) ?? { taxKind: kind, label: TAX_KIND_LABELS[kind] ?? kind, count: 0, computedPkr: 0, paidPkr: 0 };
    r.count += 1;
    r.computedPkr += Number(p.computedAmountPkr ?? 0);
    r.paidPkr += Number(p.paidAmountPkr ?? 0);
    grouped.set(kind, r);
  }

  // Ushr aggregate (uses created_at as fallback date proxy).
  const allUshr = await db.select().from(ushrSettlements);
  const ushrInRange = allUshr.filter((u) => {
    const d = u.settledOn ?? (u.createdAt as Date).toISOString().slice(0, 10);
    return d >= rangeStart && d <= rangeEnd;
  });
  const ushrTotalKg = ushrInRange.reduce((a, u) => a + Number(u.ushrKg), 0);
  const ushrTotalValuePkr = ushrInRange.reduce((a, u) => a + Number(u.ushrValuePkr ?? 0), 0);
  if (ushrInRange.length) {
    grouped.set('ushr_kind', {
      taxKind: 'ushr_kind',
      label: 'Ushr (5pct irrigated / 10pct rain-fed)',
      count: ushrInRange.length,
      computedPkr: ushrTotalValuePkr,
      paidPkr: ushrInRange.filter((u) => u.settledOn).reduce((a, u) => a + Number(u.ushrValuePkr ?? 0), 0),
    });
  }

  const zakats = await db.select().from(zakatAssessments).where(
    and(eq(zakatAssessments.entityId, entityId), gte(zakatAssessments.assessmentDate, rangeStart), lte(zakatAssessments.assessmentDate, rangeEnd)),
  );
  if (zakats.length) {
    grouped.set('zakat_kind', {
      taxKind: 'zakat_kind',
      label: 'Zakat',
      count: zakats.length,
      computedPkr: zakats.reduce((a, z) => a + Number(z.zakatDuePkr), 0),
      paidPkr: zakats.reduce((a, z) => a + Number(z.paidPkr), 0),
    });
  }

  const rows = [...grouped.values()].sort((a, b) => b.computedPkr - a.computedPkr);
  return {
    rangeStart,
    rangeEnd,
    rows,
    totalComputedPkr: rows.reduce((a, r) => a + r.computedPkr, 0),
    totalPaidPkr: rows.reduce((a, r) => a + r.paidPkr, 0),
    ushrTotalKg,
    ushrTotalValuePkr,
  };
}
