import { and, between, eq, lte, sql, inArray } from 'drizzle-orm';
import { db, accounts, journalLines, journalEntries } from '@zameen/db';
import type { BilingualLabel, CashFlowStatement, StatementLine, StatementSection } from './types.js';

const CASH_CODES = ['1000', '1010'];

interface FlowRow {
  code: string;
  name: string;
  nameUr: string | null;
  accountType: string;
  debit: string;
  credit: string;
}

function labelOf(name: string, nameUr: string | null): BilingualLabel {
  return { en: name, ur: nameUr ?? name };
}

function sectionTotal(lines: StatementLine[]): number {
  return Number(lines.reduce((a, l) => a + l.amountRupees, 0).toFixed(2));
}

async function cashBalanceAsOf(entityId: string, date: string): Promise<number> {
  const cashAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.entityId, entityId), inArray(accounts.code, CASH_CODES)));
  const ids = cashAccounts.map((a) => a.id);
  if (ids.length === 0) return 0;
  const rows = await db
    .select({
      debit: sql<string>`coalesce(sum(${journalLines.debitPkr}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLines.creditPkr}), 0)`,
    })
    .from(journalLines)
    .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(and(inArray(journalLines.accountId, ids), lte(journalEntries.postedOn, date)));
  const r = rows[0];
  if (!r) return 0;
  return Number((Number(r.debit) - Number(r.credit)).toFixed(2));
}

/**
 * Cash flow via the indirect-counterparty method. For every journal line that
 * affects cash/bank, we credit the opposite line to operating, investing, or
 * financing based on the counterparty account type.
 */
export async function buildCashFlow(
  entityId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CashFlowStatement> {
  const opening = await cashBalanceAsOf(entityId, dayBefore(periodStart));
  const closing = await cashBalanceAsOf(entityId, periodEnd);

  const rows = await db
    .select({
      code: accounts.code,
      name: accounts.name,
      nameUr: accounts.nameUr,
      accountType: accounts.accountType,
      debit: sql<string>`coalesce(sum(${journalLines.debitPkr}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLines.creditPkr}), 0)`,
    })
    .from(accounts)
    .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
    .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(and(eq(accounts.entityId, entityId), between(journalEntries.postedOn, periodStart, periodEnd)))
    .groupBy(accounts.code, accounts.name, accounts.nameUr, accounts.accountType);

  const operatingLines: StatementLine[] = [];
  const investingLines: StatementLine[] = [];
  const financingLines: StatementLine[] = [];

  for (const r of rows as FlowRow[]) {
    if (CASH_CODES.includes(r.code)) continue;
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    let flow = 0;
    if (r.accountType === 'revenue') flow = credit - debit;
    else if (r.accountType === 'expense') flow = -(debit - credit);
    else if (r.accountType === 'asset') flow = -(debit - credit);
    else if (r.accountType === 'liability' || r.accountType === 'equity') flow = credit - debit;
    if (Math.abs(flow) < 0.005) continue;
    const line: StatementLine = { accountCode: r.code, label: labelOf(r.name, r.nameUr), amountRupees: Number(flow.toFixed(2)) };
    if (r.accountType === 'revenue' || r.accountType === 'expense') {
      operatingLines.push(line);
    } else if (r.accountType === 'asset') {
      const isLongTerm = r.code.startsWith('15') || r.code.startsWith('16');
      (isLongTerm ? investingLines : operatingLines).push(line);
    } else if (r.accountType === 'liability') {
      const isLoan = r.code.startsWith('21');
      (isLoan ? financingLines : operatingLines).push(line);
    } else if (r.accountType === 'equity') {
      financingLines.push(line);
    }
  }

  const operating: StatementSection = {
    title: { en: 'Operating Activities', ur: 'آپریٹنگ سرگرمیاں' },
    lines: operatingLines,
    subtotalRupees: sectionTotal(operatingLines),
  };
  const investing: StatementSection = {
    title: { en: 'Investing Activities', ur: 'سرمایہ کاری سرگرمیاں' },
    lines: investingLines,
    subtotalRupees: sectionTotal(investingLines),
  };
  const financing: StatementSection = {
    title: { en: 'Financing Activities', ur: 'مالی سرگرمیاں' },
    lines: financingLines,
    subtotalRupees: sectionTotal(financingLines),
  };
  const netChange = Number(
    (operating.subtotalRupees + investing.subtotalRupees + financing.subtotalRupees).toFixed(2),
  );

  return {
    entityId,
    periodStart,
    periodEnd,
    operating,
    investing,
    financing,
    openingCashRupees: opening,
    closingCashRupees: closing,
    netChangeRupees: netChange,
  };
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
