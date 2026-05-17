/**
 * Reconciliation utilities.
 *
 * Three independent reconciliations, all variance-flagging. Bank reco
 * matches Soneri statement rows to journal entries; stock recos check
 * book-vs-physical for inputs and diesel tanks. None of them mutate
 * state - they return variances for human review.
 */

import { and, eq, lte } from 'drizzle-orm';
import {
  db,
  inputs,
  inputPurchases,
  inputIssuances,
  fuelStorageTanks,
  dieselPurchases,
  dieselDailyLogs,
  journalEntries,
} from '@zameen/db';
import { DIESEL_VARIANCE_TOLERANCE_PCT } from '@zameen/shared';

export interface InputVariance {
  inputId: string;
  name: string;
  purchasedQty: number;
  issuedQty: number;
  bookOnHand: number;
  variance: number;
}

/**
 * For each input, compute purchases - issuances and surface any non-zero
 * delta as a variance row. Caller decides what threshold matters.
 */
export async function reconcileInputStock({
  entityId,
  asOfDate,
}: {
  entityId: string;
  asOfDate: string;
}): Promise<InputVariance[]> {
  const ins = await db.select().from(inputs).where(eq(inputs.entityId, entityId));
  const out: InputVariance[] = [];
  for (const i of ins) {
    const purchases = await db
      .select()
      .from(inputPurchases)
      .where(and(eq(inputPurchases.inputId, i.id), lte(inputPurchases.purchasedOn, new Date(asOfDate))));
    const issuances = await db
      .select()
      .from(inputIssuances)
      .where(and(eq(inputIssuances.inputId, i.id), lte(inputIssuances.issuedOn, new Date(asOfDate))));
    const purchasedQty = purchases.reduce((a, p) => a + Number(p.quantity), 0);
    const issuedQty = issuances.reduce((a, p) => a + Number(p.quantity), 0);
    const bookOnHand = purchasedQty - issuedQty;
    out.push({
      inputId: i.id,
      name: i.name,
      purchasedQty,
      issuedQty,
      bookOnHand,
      variance: bookOnHand,
    });
  }
  return out;
}

export interface DieselReconResult {
  tankId: string;
  openingLiters: number;
  purchasesInLiters: number;
  issuancesOutLiters: number;
  expectedClosingLiters: number;
  actualClosingLiters: number;
  varianceLiters: number;
  variancePct: number;
  withinTolerance: boolean;
  physicalCheckPhotoUrls: string[];
}

/**
 * Recompute diesel-tank book vs physical at a given date. Crosses tolerance
 * tripped by `DIESEL_VARIANCE_TOLERANCE_PCT` get surfaced for an alert.
 */
export async function reconcileDieselStock({
  tankId,
  asOfDate,
}: {
  tankId: string;
  asOfDate: string;
}): Promise<DieselReconResult> {
  const [tank] = await db.select().from(fuelStorageTanks).where(eq(fuelStorageTanks.id, tankId)).limit(1);
  if (!tank) throw new Error(`Tank ${tankId} not found`);
  const asOf = new Date(asOfDate);

  const purchases = await db
    .select()
    .from(dieselPurchases)
    .where(and(eq(dieselPurchases.filledToTankId, tankId), lte(dieselPurchases.purchasedAt, asOf)));
  const purchasesInLiters = purchases.reduce((a, p) => a + Number(p.quantityLiters), 0);

  const logs = await db
    .select()
    .from(dieselDailyLogs)
    .where(and(eq(dieselDailyLogs.sourceTankId, tankId), lte(dieselDailyLogs.logDate, asOfDate)));
  const issuancesOutLiters = logs.reduce((a, l) => a + Number(l.dieselFilledLiters), 0);

  const openingLiters = 0; // Books opened with empty tank; lifetime since seed.
  const expected = openingLiters + purchasesInLiters - issuancesOutLiters;
  const actual = Number(tank.currentStockLiters);
  const varianceLiters = Number((actual - expected).toFixed(2));
  const variancePct = expected > 0 ? Number(((Math.abs(varianceLiters) / expected) * 100).toFixed(3)) : 0;

  return {
    tankId,
    openingLiters,
    purchasesInLiters,
    issuancesOutLiters,
    expectedClosingLiters: expected,
    actualClosingLiters: actual,
    varianceLiters,
    variancePct,
    withinTolerance: variancePct <= DIESEL_VARIANCE_TOLERANCE_PCT,
    physicalCheckPhotoUrls: [],
  };
}

export interface BankStatementRow {
  postedOn: string;
  description: string;
  debitPkr: number;
  creditPkr: number;
  balancePkr?: number;
  reference?: string;
}

export interface BankMatch {
  statementRow: BankStatementRow;
  journalEntryId: string;
  journalNumber: string;
  confidence: number;
}

export interface BankReconResult {
  matched: BankMatch[];
  unmatchedStatementRows: BankStatementRow[];
  unmatchedJournalIds: string[];
}

function parseCsv(csv: string): BankStatementRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map((s) => s.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: BankStatementRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((s) => s.trim());
    out.push({
      postedOn: cols[idx('date')] ?? cols[idx('posted_on')] ?? '',
      description: cols[idx('description')] ?? '',
      debitPkr: Number(cols[idx('debit')] ?? '0') || 0,
      creditPkr: Number(cols[idx('credit')] ?? '0') || 0,
      balancePkr: Number(cols[idx('balance')] ?? '0') || undefined,
      reference: cols[idx('reference')] ?? cols[idx('ref')] ?? undefined,
    });
  }
  return out;
}

/**
 * Match Soneri CSV statement rows against entity journal entries by date and
 * amount. Returns the match set plus both unmatched lists so finance can
 * book corrections.
 */
export async function reconcileBank({
  entityId,
  statementCsv,
}: {
  entityId: string;
  statementCsv: string;
}): Promise<BankReconResult> {
  const rows = parseCsv(statementCsv);
  const entries = await db.select().from(journalEntries).where(eq(journalEntries.entityId, entityId));

  const matched: BankMatch[] = [];
  const usedJournalIds = new Set<string>();
  const unmatchedRows: BankStatementRow[] = [];

  for (const row of rows) {
    const rowAmount = row.debitPkr || row.creditPkr;
    const candidate = entries.find((e) => {
      if (usedJournalIds.has(e.id)) return false;
      if (e.postedOn !== row.postedOn) return false;
      const total = Math.max(Number(e.totalDebitPkr), Number(e.totalCreditPkr));
      return Math.abs(total - rowAmount) <= 0.5;
    });
    if (candidate) {
      usedJournalIds.add(candidate.id);
      matched.push({ statementRow: row, journalEntryId: candidate.id, journalNumber: candidate.journalNumber, confidence: 0.95 });
    } else {
      unmatchedRows.push(row);
    }
  }

  const unmatchedJournalIds = entries.filter((e) => !usedJournalIds.has(e.id)).map((e) => e.id);
  return { matched, unmatchedStatementRows: unmatchedRows, unmatchedJournalIds };
}
