/**
 * Straight-line depreciation scheduler and poster.
 *
 * Assets carry book value via accumulated-depreciation journal entries
 * rather than mutating the asset row directly. This keeps the audit trail
 * inside the general ledger and makes reversals safe.
 */

import { and, eq, gte, lte } from 'drizzle-orm';
import { db, assets, journalEntries } from '@zameen/db';
import { postJournal } from './journal.js';

export interface DepreciationEntry {
  postedOn: string;
  monthIndex: number;
  amountPkr: number;
  assetId: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(d: Date, m: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + m);
  return out;
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

/**
 * Build the full straight-line schedule for an asset. Useful for UI
 * previews and for reconciling planned vs posted depreciation.
 */
export async function scheduleDepreciation(assetId: string): Promise<DepreciationEntry[]> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  if (!asset.purchaseDate || !asset.purchasePricePkr || !asset.usefulLifeYears) {
    return [];
  }
  const months = asset.usefulLifeYears * 12;
  const monthlyAmount = Number((Number(asset.purchasePricePkr) / months).toFixed(2));
  const start = new Date(asset.purchaseDate);
  const out: DepreciationEntry[] = [];
  for (let i = 0; i < months; i++) {
    const monthEnd = endOfMonth(addMonths(start, i));
    out.push({
      postedOn: isoDay(monthEnd),
      monthIndex: i,
      amountPkr: monthlyAmount,
      assetId,
    });
  }
  // Push residual to last row so total matches purchase price exactly.
  const drift = Number(asset.purchasePricePkr) - out.reduce((a, b) => a + b.amountPkr, 0);
  if (out.length > 0) out[out.length - 1]!.amountPkr = Number((out[out.length - 1]!.amountPkr + drift).toFixed(2));
  return out;
}

/**
 * Post one period's depreciation across every active asset for an entity.
 * Idempotent: it scans journal entries for the matching source-record-id
 * and skips assets that have already been posted in the window.
 */
export async function postMonthlyDepreciation(
  entityId: string,
  periodStart: string,
  periodEnd: string,
): Promise<string[]> {
  const assetRows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.entityId, entityId), eq(assets.isActive, true)));

  const posted: string[] = [];
  for (const a of assetRows) {
    if (!a.purchaseDate || !a.purchasePricePkr || !a.usefulLifeYears) continue;
    const monthlyAmount = Number((Number(a.purchasePricePkr) / (a.usefulLifeYears * 12)).toFixed(2));

    // Idempotency check.
    const existing = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.entityId, entityId),
          eq(journalEntries.sourceModule, 'depreciation'),
          eq(journalEntries.sourceRecordId, a.id),
          gte(journalEntries.postedOn, periodStart),
          lte(journalEntries.postedOn, periodEnd),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    const journalNumber = `DEP-${a.code}-${periodEnd}`;
    const id = await postJournal({
      entityId,
      postedOn: periodEnd,
      narration: `Depreciation for ${a.code} (${a.make ?? ''} ${a.model ?? ''})`,
      sourceModule: 'depreciation',
      sourceRecordId: a.id,
      journalNumber,
      lines: [
        { accountCode: '6500', debitPkr: monthlyAmount, assetId: a.id, costPool: 'depreciation', narration: 'depreciation expense' },
        { accountCode: '1599', creditPkr: monthlyAmount, assetId: a.id, narration: 'accumulated depreciation' },
      ],
    });
    posted.push(id);
  }
  return posted;
}
