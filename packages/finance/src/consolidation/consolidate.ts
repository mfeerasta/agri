import { and, between, eq, lte, gte, isNull, or, inArray } from 'drizzle-orm';
import {
  db,
  entities,
  entityRelationships,
  intercompanyTransactions,
  consolidationRuns,
} from '@zameen/db';
import type { EntityRelationship } from '@zameen/db';
import { buildBalanceSheet } from '../statements/balance-sheet.js';
import { buildIncomeStatement } from '../statements/income-statement.js';
import { buildCashFlow } from '../statements/cash-flow.js';
import type {
  BalanceSheet,
  CashFlowStatement,
  IncomeStatement,
  StatementLine,
  StatementSection,
} from '../statements/types.js';

export interface PerEntityStatements {
  entityId: string;
  entityCode: string;
  entityName: string;
  ownershipPct: number;
  method: string;
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
  cashFlow: CashFlowStatement;
}

export interface EliminationEntry {
  intercompanyTransactionId: string;
  fromEntityId: string;
  toEntityId: string;
  amountPkr: number;
  kind: string | null;
  description: string;
}

export interface ConsolidatedReport {
  parentEntityId: string;
  periodStart: string;
  periodEnd: string;
  childEntities: string[];
  perEntity: PerEntityStatements[];
  beforeEliminations: {
    balanceSheet: BalanceSheet;
    incomeStatement: IncomeStatement;
    cashFlow: CashFlowStatement;
  };
  consolidated: {
    balanceSheet: BalanceSheet;
    incomeStatement: IncomeStatement;
    cashFlow: CashFlowStatement;
  };
  eliminationsApplied: EliminationEntry[];
}

export interface RunConsolidationParams {
  parentEntityId: string;
  periodStart: string;
  periodEnd: string;
  includeChildEntityIds?: string[];
  persistRunBy?: string;
}

interface ScaleFactorFn {
  (ownershipPct: number, method: string): number;
}

const scaleFactor: ScaleFactorFn = (ownershipPct, method) => {
  if (method === 'full') return 1;
  if (method === 'proportional') return ownershipPct / 100;
  if (method === 'equity' || method === 'cost') return 0;
  return 1;
};

function emptySection(titleEn: string, titleUr: string): StatementSection {
  return { title: { en: titleEn, ur: titleUr }, lines: [], subtotalRupees: 0 };
}

function mergeLines(existing: StatementLine[], incoming: StatementLine[], factor: number): void {
  for (const line of incoming) {
    const scaled = Number((line.amountRupees * factor).toFixed(2));
    if (Math.abs(scaled) < 0.005) continue;
    const key = line.accountCode ?? line.label.en;
    const found = existing.find((l) => (l.accountCode ?? l.label.en) === key);
    if (found) {
      found.amountRupees = Number((found.amountRupees + scaled).toFixed(2));
    } else {
      existing.push({ ...line, amountRupees: scaled });
    }
  }
}

function sectionTotal(lines: StatementLine[]): number {
  return Number(lines.reduce((a, l) => a + l.amountRupees, 0).toFixed(2));
}

function sortLines(lines: StatementLine[]): StatementLine[] {
  return lines.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? ''));
}

async function activeChildRelationships(
  parentEntityId: string,
  asOf: string,
): Promise<EntityRelationship[]> {
  return db
    .select()
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.parentEntityId, parentEntityId),
        lte(entityRelationships.effectiveFrom, asOf),
        or(isNull(entityRelationships.effectiveTo), gte(entityRelationships.effectiveTo, asOf)),
      ),
    );
}

function combineBalanceSheets(parts: PerEntityStatements[]): BalanceSheet {
  const assets = emptySection('Assets', 'اثاثے');
  const liabilities = emptySection('Liabilities', 'واجبات');
  const equity = emptySection('Equity', 'سرمایہ');
  for (const p of parts) {
    const f = scaleFactor(p.ownershipPct, p.method);
    mergeLines(assets.lines, p.balanceSheet.assets.lines, f);
    mergeLines(liabilities.lines, p.balanceSheet.liabilities.lines, f);
    mergeLines(equity.lines, p.balanceSheet.equity.lines, f);
  }
  assets.lines = sortLines(assets.lines);
  liabilities.lines = sortLines(liabilities.lines);
  equity.lines = sortLines(equity.lines);
  assets.subtotalRupees = sectionTotal(assets.lines);
  liabilities.subtotalRupees = sectionTotal(liabilities.lines);
  equity.subtotalRupees = sectionTotal(equity.lines);
  const totalLiabEq = Number((liabilities.subtotalRupees + equity.subtotalRupees).toFixed(2));
  return {
    entityId: parts[0]?.balanceSheet.entityId ?? '',
    asOf: parts[0]?.balanceSheet.asOf ?? '',
    assets,
    liabilities,
    equity,
    totalLiabEqRupees: totalLiabEq,
    balanced: Math.abs(assets.subtotalRupees - totalLiabEq) < 1,
  };
}

function combineIncomeStatements(parts: PerEntityStatements[]): IncomeStatement {
  const revenue = emptySection('Revenue', 'آمدنی');
  const expenses = emptySection('Expenses', 'اخراجات');
  for (const p of parts) {
    const f = scaleFactor(p.ownershipPct, p.method);
    mergeLines(revenue.lines, p.incomeStatement.revenue.lines, f);
    mergeLines(expenses.lines, p.incomeStatement.expenses.lines, f);
  }
  revenue.lines = sortLines(revenue.lines);
  expenses.lines = sortLines(expenses.lines);
  revenue.subtotalRupees = sectionTotal(revenue.lines);
  expenses.subtotalRupees = sectionTotal(expenses.lines);
  return {
    entityId: parts[0]?.incomeStatement.entityId ?? '',
    periodStart: parts[0]?.incomeStatement.periodStart ?? '',
    periodEnd: parts[0]?.incomeStatement.periodEnd ?? '',
    revenue,
    expenses,
    netIncomeRupees: Number((revenue.subtotalRupees - expenses.subtotalRupees).toFixed(2)),
  };
}

function combineCashFlows(parts: PerEntityStatements[]): CashFlowStatement {
  const operating = emptySection('Operating Activities', 'آپریٹنگ سرگرمیاں');
  const investing = emptySection('Investing Activities', 'سرمایہ کاری سرگرمیاں');
  const financing = emptySection('Financing Activities', 'مالی سرگرمیاں');
  let opening = 0;
  let closing = 0;
  for (const p of parts) {
    const f = scaleFactor(p.ownershipPct, p.method);
    mergeLines(operating.lines, p.cashFlow.operating.lines, f);
    mergeLines(investing.lines, p.cashFlow.investing.lines, f);
    mergeLines(financing.lines, p.cashFlow.financing.lines, f);
    opening += p.cashFlow.openingCashRupees * f;
    closing += p.cashFlow.closingCashRupees * f;
  }
  operating.lines = sortLines(operating.lines);
  investing.lines = sortLines(investing.lines);
  financing.lines = sortLines(financing.lines);
  operating.subtotalRupees = sectionTotal(operating.lines);
  investing.subtotalRupees = sectionTotal(investing.lines);
  financing.subtotalRupees = sectionTotal(financing.lines);
  const netChange = Number(
    (operating.subtotalRupees + investing.subtotalRupees + financing.subtotalRupees).toFixed(2),
  );
  return {
    entityId: parts[0]?.cashFlow.entityId ?? '',
    periodStart: parts[0]?.cashFlow.periodStart ?? '',
    periodEnd: parts[0]?.cashFlow.periodEnd ?? '',
    operating,
    investing,
    financing,
    openingCashRupees: Number(opening.toFixed(2)),
    closingCashRupees: Number(closing.toFixed(2)),
    netChangeRupees: netChange,
  };
}

function applyEliminations(
  bs: BalanceSheet,
  is: IncomeStatement,
  cf: CashFlowStatement,
  eliminations: EliminationEntry[],
): { balanceSheet: BalanceSheet; incomeStatement: IncomeStatement; cashFlow: CashFlowStatement } {
  const eliminatedBs: BalanceSheet = JSON.parse(JSON.stringify(bs));
  const eliminatedIs: IncomeStatement = JSON.parse(JSON.stringify(is));
  const eliminatedCf: CashFlowStatement = JSON.parse(JSON.stringify(cf));

  for (const e of eliminations) {
    const amt = e.amountPkr;
    if (e.kind === 'loan') {
      // Drop intercompany receivable (asset) and payable (liability)
      const recv = eliminatedBs.assets.lines.find((l) => l.accountCode === '1300');
      if (recv) recv.amountRupees = Number((recv.amountRupees - amt).toFixed(2));
      const pay = eliminatedBs.liabilities.lines.find((l) => l.accountCode === '2100');
      if (pay) pay.amountRupees = Number((pay.amountRupees - amt).toFixed(2));
    } else if (e.kind === 'sale' || e.kind === 'service' || e.kind === 'rent') {
      // Drop matched intercompany revenue and matching expense
      const rev = eliminatedIs.revenue.lines.find((l) => l.label.en.toLowerCase().includes('inter'));
      if (rev) rev.amountRupees = Number((rev.amountRupees - amt).toFixed(2));
      const exp = eliminatedIs.expenses.lines.find((l) => l.label.en.toLowerCase().includes('inter'));
      if (exp) exp.amountRupees = Number((exp.amountRupees - amt).toFixed(2));
    } else if (e.kind === 'transfer' || e.kind === 'dividend' || e.kind === 'allocation') {
      // Drop in equity / cash transfers between group members
      const eq = eliminatedBs.equity.lines.find((l) => l.label.en.toLowerCase().includes('inter'));
      if (eq) eq.amountRupees = Number((eq.amountRupees - amt).toFixed(2));
    }
  }

  // Recompute subtotals
  for (const section of [eliminatedBs.assets, eliminatedBs.liabilities, eliminatedBs.equity]) {
    section.subtotalRupees = sectionTotal(section.lines);
  }
  eliminatedBs.totalLiabEqRupees = Number(
    (eliminatedBs.liabilities.subtotalRupees + eliminatedBs.equity.subtotalRupees).toFixed(2),
  );
  eliminatedBs.balanced =
    Math.abs(eliminatedBs.assets.subtotalRupees - eliminatedBs.totalLiabEqRupees) < 1;

  eliminatedIs.revenue.subtotalRupees = sectionTotal(eliminatedIs.revenue.lines);
  eliminatedIs.expenses.subtotalRupees = sectionTotal(eliminatedIs.expenses.lines);
  eliminatedIs.netIncomeRupees = Number(
    (eliminatedIs.revenue.subtotalRupees - eliminatedIs.expenses.subtotalRupees).toFixed(2),
  );

  return { balanceSheet: eliminatedBs, incomeStatement: eliminatedIs, cashFlow: eliminatedCf };
}

export async function findEliminationCandidates(
  entityIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<EliminationEntry[]> {
  if (entityIds.length < 2) return [];
  const rows = await db
    .select()
    .from(intercompanyTransactions)
    .where(
      and(
        between(intercompanyTransactions.transactionDate, periodStart, periodEnd),
        inArray(intercompanyTransactions.fromEntityId, entityIds),
        inArray(intercompanyTransactions.toEntityId, entityIds),
      ),
    );
  return rows.map((r) => ({
    intercompanyTransactionId: r.id,
    fromEntityId: r.fromEntityId,
    toEntityId: r.toEntityId,
    amountPkr: Number(r.amountPkr),
    kind: r.kind,
    description: r.description,
  }));
}

export async function runConsolidation(params: RunConsolidationParams): Promise<ConsolidatedReport> {
  const { parentEntityId, periodStart, periodEnd } = params;

  const rels = await activeChildRelationships(parentEntityId, periodEnd);
  const filtered = params.includeChildEntityIds
    ? rels.filter((r) => params.includeChildEntityIds!.includes(r.childEntityId))
    : rels;

  // Parent is always full method, 100%
  const allEntityIds = [parentEntityId, ...filtered.map((r) => r.childEntityId)];
  const entityRows = await db.select().from(entities).where(inArray(entities.id, allEntityIds));
  const entityMap = new Map(entityRows.map((e) => [e.id, e]));

  const perEntity: PerEntityStatements[] = [];

  // Parent first
  const parentEnt = entityMap.get(parentEntityId);
  if (parentEnt) {
    perEntity.push({
      entityId: parentEntityId,
      entityCode: parentEnt.code,
      entityName: parentEnt.name,
      ownershipPct: 100,
      method: 'full',
      balanceSheet: await buildBalanceSheet(parentEntityId, periodEnd),
      incomeStatement: await buildIncomeStatement(parentEntityId, periodStart, periodEnd),
      cashFlow: await buildCashFlow(parentEntityId, periodStart, periodEnd),
    });
  }

  for (const rel of filtered) {
    const child = entityMap.get(rel.childEntityId);
    if (!child) continue;
    perEntity.push({
      entityId: rel.childEntityId,
      entityCode: child.code,
      entityName: child.name,
      ownershipPct: Number(rel.ownershipPct),
      method: rel.consolidationMethod,
      balanceSheet: await buildBalanceSheet(rel.childEntityId, periodEnd),
      incomeStatement: await buildIncomeStatement(rel.childEntityId, periodStart, periodEnd),
      cashFlow: await buildCashFlow(rel.childEntityId, periodStart, periodEnd),
    });
  }

  const beforeBs = combineBalanceSheets(perEntity);
  const beforeIs = combineIncomeStatements(perEntity);
  const beforeCf = combineCashFlows(perEntity);

  const eliminations = await findEliminationCandidates(allEntityIds, periodStart, periodEnd);
  const consolidated = applyEliminations(beforeBs, beforeIs, beforeCf, eliminations);

  const report: ConsolidatedReport = {
    parentEntityId,
    periodStart,
    periodEnd,
    childEntities: filtered.map((r) => r.childEntityId),
    perEntity,
    beforeEliminations: {
      balanceSheet: beforeBs,
      incomeStatement: beforeIs,
      cashFlow: beforeCf,
    },
    consolidated,
    eliminationsApplied: eliminations,
  };

  if (params.persistRunBy) {
    await db.insert(consolidationRuns).values({
      parentEntityId,
      periodStart,
      periodEnd,
      consolidatedBy: params.persistRunBy,
      balanceSheetSnapshot: consolidated.balanceSheet as unknown as Record<string, unknown>,
      incomeStatementSnapshot: consolidated.incomeStatement as unknown as Record<string, unknown>,
      cashFlowSnapshot: consolidated.cashFlow as unknown as Record<string, unknown>,
      eliminationsApplied: eliminations as unknown as Record<string, unknown>[],
      childEntities: filtered.map((r) => r.childEntityId) as unknown as Record<string, unknown>,
      status: 'draft',
    });
  }

  return report;
}

export async function finalizeConsolidationRun(runId: string): Promise<void> {
  await db
    .update(consolidationRuns)
    .set({ status: 'final' })
    .where(eq(consolidationRuns.id, runId));
}
