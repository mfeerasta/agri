import { and, eq, lte, sql } from 'drizzle-orm';
import { db, accounts, journalLines, journalEntries } from '@zameen/db';
import type { BalanceSheet, BilingualLabel, StatementLine, StatementSection } from './types.js';

interface BalanceRow {
  accountId: string;
  code: string;
  name: string;
  nameUr: string | null;
  accountType: string;
  debitTotal: string;
  creditTotal: string;
}

function balanceFor(type: string, debit: number, credit: number): number {
  if (type === 'asset' || type === 'expense') return debit - credit;
  return credit - debit;
}

function labelOf(name: string, nameUr: string | null): BilingualLabel {
  return { en: name, ur: nameUr ?? name };
}

function sectionTotal(lines: StatementLine[]): number {
  return Number(lines.reduce((a, l) => a + l.amountRupees, 0).toFixed(2));
}

export async function buildBalanceSheet(entityId: string, asOf: string): Promise<BalanceSheet> {
  const rows = await db
    .select({
      accountId: accounts.id,
      code: accounts.code,
      name: accounts.name,
      nameUr: accounts.nameUr,
      accountType: accounts.accountType,
      debitTotal: sql<string>`coalesce(sum(${journalLines.debitPkr}), 0)`,
      creditTotal: sql<string>`coalesce(sum(${journalLines.creditPkr}), 0)`,
    })
    .from(accounts)
    .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
    .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(and(eq(accounts.entityId, entityId), lte(journalEntries.postedOn, asOf)))
    .groupBy(accounts.id, accounts.code, accounts.name, accounts.nameUr, accounts.accountType);

  const assetLines: StatementLine[] = [];
  const liabilityLines: StatementLine[] = [];
  const equityLines: StatementLine[] = [];

  let retainedFromPnL = 0;
  for (const r of rows as BalanceRow[]) {
    const bal = balanceFor(r.accountType, Number(r.debitTotal), Number(r.creditTotal));
    if (Math.abs(bal) < 0.005 && r.accountType !== 'equity') continue;
    const line: StatementLine = {
      accountCode: r.code,
      label: labelOf(r.name, r.nameUr),
      amountRupees: Number(bal.toFixed(2)),
    };
    if (r.accountType === 'asset') assetLines.push(line);
    else if (r.accountType === 'liability') liabilityLines.push(line);
    else if (r.accountType === 'equity') equityLines.push(line);
    else if (r.accountType === 'revenue' || r.accountType === 'expense') {
      retainedFromPnL += r.accountType === 'revenue' ? bal : -bal;
    }
  }

  if (Math.abs(retainedFromPnL) > 0.005) {
    equityLines.push({
      label: { en: 'Current Period Earnings', ur: 'موجودہ مدت کا منافع' },
      amountRupees: Number(retainedFromPnL.toFixed(2)),
    });
  }

  const assets: StatementSection = {
    title: { en: 'Assets', ur: 'اثاثے' },
    lines: assetLines.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
    subtotalRupees: sectionTotal(assetLines),
  };
  const liabilities: StatementSection = {
    title: { en: 'Liabilities', ur: 'واجبات' },
    lines: liabilityLines.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
    subtotalRupees: sectionTotal(liabilityLines),
  };
  const equity: StatementSection = {
    title: { en: 'Equity', ur: 'سرمایہ' },
    lines: equityLines.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
    subtotalRupees: sectionTotal(equityLines),
  };
  const totalLiabEq = Number((liabilities.subtotalRupees + equity.subtotalRupees).toFixed(2));

  return {
    entityId,
    asOf,
    assets,
    liabilities,
    equity,
    totalLiabEqRupees: totalLiabEq,
    balanced: Math.abs(assets.subtotalRupees - totalLiabEq) < 1,
  };
}
