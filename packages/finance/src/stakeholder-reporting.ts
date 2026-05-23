// stakeholder-reporting.ts
//
// Builds period reports for stakeholders (lenders, grant providers, impact
// investors, government). Pulls statements + KPI actuals + sustainability
// metrics + repayment schedules into a kind-specific snapshot. PDF rendering
// lives alongside in pdf/stakeholder-report-pdf.tsx. No links to Sentinel
// or Haazri.

import { and, between, desc, eq, gte, lte } from 'drizzle-orm';
import {
  db,
  entities,
  kpiActuals,
  kpiDefinitions,
  stakeholderReports,
  stakeholders,
  carbonAssessments,
  esgMetricsSnapshots,
  sustainabilityPractices,
  type Stakeholder,
  type StakeholderKind,
} from '@zameen/db';
import { buildIncomeStatement } from './statements/income-statement.js';
import { buildBalanceSheet } from './statements/balance-sheet.js';
import { buildCashFlowStatement } from './statements/cash-flow.js';
import type { BalanceSheet, CashFlowStatement, IncomeStatement } from './statements/types.js';

export interface BuildReportInput {
  stakeholderId: string;
  periodStart: string;
  periodEnd: string;
  dueDate?: string;
}

export interface KpiSnapshotRow {
  code: string;
  name: string;
  category: string;
  unit: string;
  value: number;
  targetValue: number | null;
  variancePct: number | null;
}

export interface SustainabilitySnapshot {
  netCo2eTons: number | null;
  assessmentDate: string | null;
  activePractices: number;
  esgFramework: string | null;
  esgPeriodEnd: string | null;
}

export interface LenderCovenantsSection {
  exposurePkr: number | null;
  currentRatio: number | null;
  debtServiceCoverage: number | null;
  notes: string[];
}

export interface GrantMilestoneSection {
  milestones: Array<{ label: string; status: string; evidenceUrls: string[] }>;
  fundsUtilisedPkr: number;
  fundsRemainingPkr: number | null;
}

export interface ImpactInvestorSection {
  esg: SustainabilitySnapshot;
  scale: {
    acresUnderManagement: number | null;
    workersEmployed: number | null;
    womenSharePct: number | null;
  };
}

export interface GovernmentSection {
  employmentCount: number | null;
  agriOutputKg: number | null;
  taxesPaidPkr: number | null;
  zakatPaidPkr: number | null;
}

export interface StakeholderReportSnapshot {
  stakeholder: {
    id: string;
    name: string;
    kind: StakeholderKind;
    contactPerson: string | null;
    email: string | null;
    exposurePkr: number | null;
  };
  entity: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  income: IncomeStatement | null;
  balanceSheet: BalanceSheet | null;
  cashFlow: CashFlowStatement | null;
  kpis: KpiSnapshotRow[];
  sustainability: SustainabilitySnapshot;
  lender?: LenderCovenantsSection;
  grant?: GrantMilestoneSection;
  impactInvestor?: ImpactInvestorSection;
  government?: GovernmentSection;
  generatedAt: string;
}

const LENDER_KINDS: ReadonlyArray<StakeholderKind> = ['lender_bank', 'lender_microfinance'];

export async function buildReport(input: BuildReportInput): Promise<StakeholderReportSnapshot> {
  const { stakeholderId, periodStart, periodEnd } = input;

  const [st] = await db
    .select()
    .from(stakeholders)
    .where(eq(stakeholders.id, stakeholderId));
  if (!st) throw new Error(`Stakeholder ${stakeholderId} not found`);

  const [ent] = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.id, st.entityId));
  if (!ent) throw new Error(`Entity ${st.entityId} not found`);

  const kind = st.stakeholderKind as StakeholderKind;
  const includesFinancials =
    LENDER_KINDS.includes(kind) || kind === 'impact_investor' || kind === 'government';

  const [income, balance, cash] = includesFinancials
    ? await Promise.all([
        buildIncomeStatement(ent.id, periodStart, periodEnd),
        buildBalanceSheet(ent.id, periodEnd),
        buildCashFlowStatement(ent.id, periodStart, periodEnd),
      ])
    : [null, null, null];

  const kpiRows = await db
    .select({
      code: kpiDefinitions.code,
      name: kpiDefinitions.name,
      category: kpiDefinitions.category,
      unit: kpiDefinitions.unit,
      value: kpiActuals.value,
      targetValue: kpiActuals.targetValue,
      variancePct: kpiActuals.variancePct,
    })
    .from(kpiActuals)
    .innerJoin(kpiDefinitions, eq(kpiDefinitions.id, kpiActuals.kpiId))
    .where(
      and(
        between(kpiActuals.periodEnd, periodStart, periodEnd),
        eq(kpiDefinitions.isActive, true),
      ),
    );
  const kpis: KpiSnapshotRow[] = kpiRows.map((r) => ({
    code: r.code,
    name: r.name,
    category: r.category,
    unit: r.unit,
    value: Number(r.value),
    targetValue: r.targetValue == null ? null : Number(r.targetValue),
    variancePct: r.variancePct == null ? null : Number(r.variancePct),
  }));

  const sustainability = await collectSustainability(ent.id, periodEnd);

  const snapshot: StakeholderReportSnapshot = {
    stakeholder: {
      id: st.id,
      name: st.name,
      kind,
      contactPerson: st.contactPerson,
      email: st.email,
      exposurePkr: st.exposurePkr == null ? null : Number(st.exposurePkr),
    },
    entity: ent,
    periodStart,
    periodEnd,
    dueDate: input.dueDate ?? periodEnd,
    income,
    balanceSheet: balance,
    cashFlow: cash,
    kpis,
    sustainability,
    generatedAt: new Date().toISOString(),
  };

  if (LENDER_KINDS.includes(kind)) {
    snapshot.lender = buildLenderSection(st, balance, cash);
  } else if (kind === 'grant_provider') {
    snapshot.grant = buildGrantSection(st);
  } else if (kind === 'impact_investor') {
    snapshot.impactInvestor = await buildImpactInvestorSection(ent.id, sustainability, kpis);
  } else if (kind === 'government') {
    snapshot.government = buildGovernmentSection(kpis);
  }

  return snapshot;
}

async function collectSustainability(entityId: string, asOf: string): Promise<SustainabilitySnapshot> {
  const [latestCarbon] = await db
    .select()
    .from(carbonAssessments)
    .where(and(eq(carbonAssessments.entityId, entityId), lte(carbonAssessments.assessmentDate, asOf)))
    .orderBy(desc(carbonAssessments.assessmentDate))
    .limit(1);
  const [latestEsg] = await db
    .select()
    .from(esgMetricsSnapshots)
    .where(and(eq(esgMetricsSnapshots.entityId, entityId), lte(esgMetricsSnapshots.periodEnd, asOf)))
    .orderBy(desc(esgMetricsSnapshots.periodEnd))
    .limit(1);
  const activePractices = await db
    .select({ id: sustainabilityPractices.id })
    .from(sustainabilityPractices)
    .where(and(eq(sustainabilityPractices.entityId, entityId), eq(sustainabilityPractices.isActive, true)));
  return {
    netCo2eTons: latestCarbon ? Number(latestCarbon.netCo2eTons) : null,
    assessmentDate: latestCarbon?.assessmentDate ?? null,
    activePractices: activePractices.length,
    esgFramework: latestEsg?.framework ?? null,
    esgPeriodEnd: latestEsg?.periodEnd ?? null,
  };
}

function buildLenderSection(
  st: Stakeholder,
  balance: BalanceSheet | null,
  cash: CashFlowStatement | null,
): LenderCovenantsSection {
  const exposurePkr = st.exposurePkr == null ? null : Number(st.exposurePkr);
  let currentRatio: number | null = null;
  if (balance) {
    const currentAssets = balance.assets.lines
      .filter((l) => (l.accountCode ?? '').startsWith('11'))
      .reduce((a, l) => a + l.amountRupees, 0);
    const currentLiabilities = balance.liabilities.lines
      .filter((l) => (l.accountCode ?? '').startsWith('21'))
      .reduce((a, l) => a + l.amountRupees, 0);
    currentRatio = currentLiabilities > 0 ? Number((currentAssets / currentLiabilities).toFixed(2)) : null;
  }
  let debtServiceCoverage: number | null = null;
  if (cash && exposurePkr && exposurePkr > 0) {
    const operating = cash.operating?.subtotalRupees ?? 0;
    debtServiceCoverage = Number((operating / exposurePkr).toFixed(2));
  }
  const notes: string[] = [];
  if (currentRatio != null && currentRatio < 1) notes.push('Current ratio below 1.0 — liquidity caution');
  if (debtServiceCoverage != null && debtServiceCoverage < 1.2) notes.push('DSCR below 1.2 — covenant risk');
  return { exposurePkr, currentRatio, debtServiceCoverage, notes };
}

function buildGrantSection(st: Stakeholder): GrantMilestoneSection {
  const req = (st.reportingRequirements ?? {}) as Record<string, unknown>;
  const rawMilestones = Array.isArray(req.milestones) ? (req.milestones as unknown[]) : [];
  const milestones = rawMilestones.map((m) => {
    const row = m as Record<string, unknown>;
    return {
      label: String(row.label ?? ''),
      status: String(row.status ?? 'pending'),
      evidenceUrls: Array.isArray(row.evidenceUrls) ? (row.evidenceUrls as string[]) : [],
    };
  });
  const fundsUtilisedPkr = Number(req.fundsUtilisedPkr ?? 0);
  const exposure = st.exposurePkr == null ? null : Number(st.exposurePkr);
  const fundsRemainingPkr = exposure == null ? null : Number((exposure - fundsUtilisedPkr).toFixed(2));
  return { milestones, fundsUtilisedPkr, fundsRemainingPkr };
}

async function buildImpactInvestorSection(
  _entityId: string,
  sustainability: SustainabilitySnapshot,
  kpis: KpiSnapshotRow[],
): Promise<ImpactInvestorSection> {
  const womenKpi = kpis.find((k) => k.code === 'women-employment-pct');
  return {
    esg: sustainability,
    scale: {
      acresUnderManagement: null,
      workersEmployed: null,
      womenSharePct: womenKpi ? womenKpi.value : null,
    },
  };
}

function buildGovernmentSection(kpis: KpiSnapshotRow[]): GovernmentSection {
  const yieldKpi = kpis.find((k) => k.code === 'yield-per-acre');
  return {
    employmentCount: null,
    agriOutputKg: yieldKpi ? yieldKpi.value : null,
    taxesPaidPkr: null,
    zakatPaidPkr: null,
  };
}

export async function persistReportSnapshot(
  input: BuildReportInput,
  snapshot: StakeholderReportSnapshot,
  pdfUrl: string | null,
): Promise<string> {
  const [row] = await db
    .insert(stakeholderReports)
    .values({
      stakeholderId: input.stakeholderId,
      reportPeriodStart: input.periodStart,
      reportPeriodEnd: input.periodEnd,
      dueDate: input.dueDate ?? input.periodEnd,
      status: 'draft',
      pdfUrl,
      dataSnapshot: snapshot as unknown as Record<string, unknown>,
    })
    .returning({ id: stakeholderReports.id });
  return row.id;
}

export function computeNextDue(
  frequency: string,
  fromDate: string,
): string {
  const d = new Date(fromDate + 'T00:00:00Z');
  const add = (days: number) => {
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const addMonths = (months: number) => {
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
  };
  switch (frequency) {
    case 'weekly':
      return add(7);
    case 'monthly':
      return addMonths(1);
    case 'quarterly':
      return addMonths(3);
    case 'semi_annual':
      return addMonths(6);
    case 'annual':
      return addMonths(12);
    default:
      return fromDate;
  }
}

export function listOverdueReports(asOf: string) {
  return db
    .select()
    .from(stakeholderReports)
    .where(
      and(
        lte(stakeholderReports.dueDate, asOf),
        gte(stakeholderReports.dueDate, '1970-01-01'),
      ),
    );
}
