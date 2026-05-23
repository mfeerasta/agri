import { and, between, eq, sql } from 'drizzle-orm';
import { db, accounts, journalLines, journalEntries } from '@zameen/db';
import type { BilingualLabel, IncomeStatement, StatementLine, StatementSection } from './types.js';

interface AccountRow {
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

export async function buildIncomeStatement(
  entityId: string,
  periodStart: string,
  periodEnd: string,
): Promise<IncomeStatement> {
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

  const revenueLines: StatementLine[] = [];
  const expenseLines: StatementLine[] = [];

  for (const r of rows as AccountRow[]) {
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    if (r.accountType === 'revenue') {
      const amt = credit - debit;
      if (Math.abs(amt) < 0.005) continue;
      revenueLines.push({ accountCode: r.code, label: labelOf(r.name, r.nameUr), amountRupees: Number(amt.toFixed(2)) });
    } else if (r.accountType === 'expense') {
      const amt = debit - credit;
      if (Math.abs(amt) < 0.005) continue;
      expenseLines.push({ accountCode: r.code, label: labelOf(r.name, r.nameUr), amountRupees: Number(amt.toFixed(2)) });
    }
  }

  const revenue: StatementSection = {
    title: { en: 'Revenue', ur: 'آمدنی' },
    lines: revenueLines.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
    subtotalRupees: sectionTotal(revenueLines),
  };
  const expenses: StatementSection = {
    title: { en: 'Expenses', ur: 'اخراجات' },
    lines: expenseLines.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
    subtotalRupees: sectionTotal(expenseLines),
  };

  return {
    entityId,
    periodStart,
    periodEnd,
    revenue,
    expenses,
    netIncomeRupees: Number((revenue.subtotalRupees - expenses.subtotalRupees).toFixed(2)),
  };
}
