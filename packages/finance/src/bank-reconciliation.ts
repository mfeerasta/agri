/**
 * Bank reconciliation engine.
 *
 * Two-pass matcher against bank_transactions: first exact match on
 * reference number, then fuzzy on amount + date window + counterparty name
 * similarity. Auto-matched rows can optionally have a balancing journal
 * entry posted on their behalf. Manual review queue surfaces the rest.
 */

import { and, eq, gte, lte, inArray, isNull } from 'drizzle-orm';
import {
  db,
  bankAccounts,
  bankTransactions,
  bankStatements,
  journalEntries,
} from '@zameen/db';

export interface AutoMatchResult {
  statementId: string;
  matchedCount: number;
  unmatchedCount: number;
  flaggedCount: number;
  unmatched: Array<{
    transactionId: string;
    transactionDate: string;
    amountPkr: number;
    direction: 'debit' | 'credit';
    description: string;
    counterparty: string | null;
  }>;
}

interface MatchCandidate {
  id: string;
  journalNumber: string;
  postedOn: string;
  totalPkr: number;
  narration: string;
  alreadyUsed: boolean;
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t)) overlap += 1;
  });
  return overlap / Math.max(ta.size, tb.size);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db2 = new Date(b).getTime();
  return Math.abs((da - db2) / (1000 * 60 * 60 * 24));
}

export async function autoMatch(statementId: string): Promise<AutoMatchResult> {
  const [stmt] = await db.select().from(bankStatements).where(eq(bankStatements.id, statementId)).limit(1);
  if (!stmt) throw new Error('Statement not found');
  const [acct] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, stmt.accountId)).limit(1);
  if (!acct) throw new Error('Account not found');

  const txns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.accountId, stmt.accountId),
        eq(bankTransactions.status, 'unreconciled'),
        gte(bankTransactions.transactionDate, stmt.periodStart),
        lte(bankTransactions.transactionDate, stmt.periodEnd),
      ),
    );

  if (txns.length === 0) {
    return { statementId, matchedCount: 0, unmatchedCount: 0, flaggedCount: 0, unmatched: [] };
  }

  const windowStart = new Date(stmt.periodStart);
  windowStart.setDate(windowStart.getDate() - 5);
  const windowEnd = new Date(stmt.periodEnd);
  windowEnd.setDate(windowEnd.getDate() + 5);

  const journals = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.entityId, acct.entityId),
        gte(journalEntries.postedOn, windowStart.toISOString().slice(0, 10)),
        lte(journalEntries.postedOn, windowEnd.toISOString().slice(0, 10)),
        isNull(journalEntries.reversedById),
      ),
    );

  const candidates: MatchCandidate[] = journals.map((j) => ({
    id: j.id,
    journalNumber: j.journalNumber,
    postedOn: j.postedOn,
    totalPkr: Math.max(Number(j.totalDebitPkr), Number(j.totalCreditPkr)),
    narration: j.narration,
    alreadyUsed: false,
  }));

  let matched = 0;
  let flagged = 0;
  const unmatched: AutoMatchResult['unmatched'] = [];

  // Pass 1: exact reference match
  for (const t of txns) {
    if (!t.referenceNumber) continue;
    const ref = t.referenceNumber.toLowerCase();
    const cand = candidates.find(
      (c) => !c.alreadyUsed && c.journalNumber.toLowerCase().includes(ref) &&
        Math.abs(c.totalPkr - Number(t.amountPkr)) <= 1,
    );
    if (cand) {
      cand.alreadyUsed = true;
      await db
        .update(bankTransactions)
        .set({
          matchedToKind: 'journal_entry',
          matchedToId: cand.id,
          matchedAt: new Date(),
          status: 'matched',
        })
        .where(eq(bankTransactions.id, t.id));
      matched += 1;
    }
  }

  // Pass 2: fuzzy amount + date + party
  const remaining = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.accountId, stmt.accountId),
        eq(bankTransactions.status, 'unreconciled'),
        gte(bankTransactions.transactionDate, stmt.periodStart),
        lte(bankTransactions.transactionDate, stmt.periodEnd),
      ),
    );

  for (const t of remaining) {
    const txnAmount = Number(t.amountPkr);
    const scored = candidates
      .filter((c) => !c.alreadyUsed)
      .map((c) => {
        const amtDelta = Math.abs(c.totalPkr - txnAmount);
        if (amtDelta > 1) return { c, score: -1 };
        const dayDelta = daysBetween(c.postedOn, t.transactionDate);
        if (dayDelta > 2) return { c, score: -1 };
        const partySim = tokenSimilarity(t.counterparty ?? t.description, c.narration);
        const dateScore = Math.max(0, 1 - dayDelta / 2);
        const score = 0.5 * dateScore + 0.5 * partySim;
        return { c, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score >= 0.4) {
      best.c.alreadyUsed = true;
      const finalStatus = best.score >= 0.7 ? 'matched' : 'flagged';
      if (finalStatus === 'flagged') flagged += 1;
      else matched += 1;
      await db
        .update(bankTransactions)
        .set({
          matchedToKind: 'journal_entry',
          matchedToId: best.c.id,
          matchedAt: new Date(),
          status: finalStatus,
        })
        .where(eq(bankTransactions.id, t.id));
    } else {
      unmatched.push({
        transactionId: t.id,
        transactionDate: t.transactionDate,
        amountPkr: txnAmount,
        direction: t.direction as 'debit' | 'credit',
        description: t.description,
        counterparty: t.counterparty,
      });
    }
  }

  await db
    .update(bankStatements)
    .set({ reconciliationStatus: unmatched.length === 0 ? 'reconciled' : 'in_progress' })
    .where(eq(bankStatements.id, statementId));

  return {
    statementId,
    matchedCount: matched,
    unmatchedCount: unmatched.length,
    flaggedCount: flagged,
    unmatched,
  };
}

export interface AccountBalance {
  accountId: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  accountKind: string;
  openingBalancePkr: number;
  totalCreditsPkr: number;
  totalDebitsPkr: number;
  currentBalancePkr: number;
}

export async function computeAccountBalances(entityId: string): Promise<AccountBalance[]> {
  const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.entityId, entityId));
  if (accts.length === 0) return [];
  const ids = accts.map((a) => a.id);
  const txns = await db.select().from(bankTransactions).where(inArray(bankTransactions.accountId, ids));
  return accts.map((a) => {
    const my = txns.filter((t) => t.accountId === a.id);
    const credits = my.filter((t) => t.direction === 'credit').reduce((s, t) => s + Number(t.amountPkr), 0);
    const debits = my.filter((t) => t.direction === 'debit').reduce((s, t) => s + Number(t.amountPkr), 0);
    const opening = Number(a.openingBalancePkr);
    return {
      accountId: a.id,
      bankName: a.bankName,
      accountTitle: a.accountTitle,
      accountNumber: a.accountNumber,
      accountKind: a.accountKind,
      openingBalancePkr: opening,
      totalCreditsPkr: credits,
      totalDebitsPkr: debits,
      currentBalancePkr: opening + credits - debits,
    };
  });
}
