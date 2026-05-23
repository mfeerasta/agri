/**
 * Shared types for bilingual financial statements.
 * Every line carries Urdu + English labels.
 */

export interface BilingualLabel {
  en: string;
  ur: string;
}

export interface StatementLine {
  accountCode?: string;
  label: BilingualLabel;
  amountRupees: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
}

export interface StatementSection {
  title: BilingualLabel;
  lines: StatementLine[];
  subtotalRupees: number;
}

export interface BalanceSheet {
  entityId: string;
  asOf: string;
  assets: StatementSection;
  liabilities: StatementSection;
  equity: StatementSection;
  totalLiabEqRupees: number;
  balanced: boolean;
}

export interface IncomeStatement {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  revenue: StatementSection;
  expenses: StatementSection;
  netIncomeRupees: number;
}

export interface CashFlowStatement {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  operating: StatementSection;
  investing: StatementSection;
  financing: StatementSection;
  openingCashRupees: number;
  closingCashRupees: number;
  netChangeRupees: number;
}

export interface StatementParams {
  entityId: string;
  from: string;
  to: string;
}
