import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import {
  db,
  cropPlans,
  fields as fieldsTable,
  cropProfiles,
  blocks as blocksTable,
  approvalActions,
  approvalRequests,
} from '@zameen/db';
import { computeFieldPnL, type FieldPnL } from '@zameen/finance';

export interface SeasonalRow {
  fieldCode: string;
  cropName: string;
  acres: number;
  yieldKg: number;
  yieldPerAcreKg: number;
  benchmarkPerAcre: number | null;
  variancePct: number | null;
  revenuePkr: number;
  totalCostPkr: number;
  grossMarginPkr: number;
  marginPerAcrePkr: number;
  costByPool: Record<string, number>;
  cropPlanId: string;
  fieldId: string;
}

export interface DecisionRow {
  occurredAt: string;
  approvalType: string;
  title: string;
  action: string;
  actorRole: string;
  comment: string | null;
}

export interface SeasonalReportData {
  rows: SeasonalRow[];
  costPools: string[];
  totals: {
    acres: number;
    yieldKg: number;
    revenuePkr: number;
    totalCostPkr: number;
    grossMarginPkr: number;
    weightedMarginPerAcrePkr: number;
  };
  decisions: DecisionRow[];
  seasonLabel: string;
  entityId: string;
}

export async function buildSeasonalReportData(
  entityId: string,
  seasonLabel: string,
): Promise<SeasonalReportData> {
  const plans = await db
    .select({
      id: cropPlans.id,
      fieldId: cropPlans.fieldId,
      cropProfileId: cropPlans.cropProfileId,
    })
    .from(cropPlans)
    .where(eq(cropPlans.seasonLabel, seasonLabel));

  if (plans.length === 0) {
    return {
      rows: [],
      costPools: [],
      totals: {
        acres: 0,
        yieldKg: 0,
        revenuePkr: 0,
        totalCostPkr: 0,
        grossMarginPkr: 0,
        weightedMarginPerAcrePkr: 0,
      },
      decisions: [],
      seasonLabel,
      entityId,
    };
  }

  const fieldIds = Array.from(new Set(plans.map((p) => p.fieldId)));
  const profileIds = Array.from(new Set(plans.map((p) => p.cropProfileId)));

  const [fieldRows, profileRows] = await Promise.all([
    db.select().from(fieldsTable).where(inArray(fieldsTable.id, fieldIds)),
    db.select().from(cropProfiles).where(inArray(cropProfiles.id, profileIds)),
  ]);
  const blockIds = Array.from(new Set(fieldRows.map((f) => f.blockId)));
  const blockRows = blockIds.length
    ? await db.select().from(blocksTable).where(inArray(blocksTable.id, blockIds))
    : [];

  const blockEntityIds = new Set(blockRows.filter((b) => b.entityId === entityId).map((b) => b.id));
  const scopedFields = fieldRows.filter((f) => blockEntityIds.has(f.blockId));
  const scopedFieldIds = new Set(scopedFields.map((f) => f.id));
  const scopedPlans = plans.filter((p) => scopedFieldIds.has(p.fieldId));

  const fieldById = new Map(scopedFields.map((f) => [f.id, f]));
  const profileById = new Map(profileRows.map((p) => [p.id, p]));

  const pnls = await Promise.all(scopedPlans.map((p) => computeFieldPnL(p.id)));
  const validPnls = pnls.filter((p): p is FieldPnL => p !== null);

  const poolSet = new Set<string>();
  for (const p of validPnls) {
    for (const k of Object.keys(p.costByPool)) poolSet.add(k);
  }
  const costPools = Array.from(poolSet).sort();

  const rows: SeasonalRow[] = validPnls.map((p) => {
    const field = fieldById.get(p.fieldId);
    const plan = scopedPlans.find((sp) => sp.id === p.cropPlanId);
    const profile = plan ? profileById.get(plan.cropProfileId) : undefined;
    const benchmark = profile?.yieldBenchmarkPerAcre ? Number(profile.yieldBenchmarkPerAcre) : null;
    const variancePct = benchmark && benchmark > 0
      ? Number((((p.yieldPerAcreKg - benchmark) / benchmark) * 100).toFixed(2))
      : null;
    return {
      fieldCode: field?.code ?? p.fieldId.slice(0, 8),
      cropName: profile?.name ?? p.cropName,
      acres: p.acres,
      yieldKg: p.yieldKg,
      yieldPerAcreKg: p.yieldPerAcreKg,
      benchmarkPerAcre: benchmark,
      variancePct,
      revenuePkr: p.revenuePkr,
      totalCostPkr: p.totalCostPkr,
      grossMarginPkr: p.grossMarginPkr,
      marginPerAcrePkr: p.marginPerAcrePkr,
      costByPool: p.costByPool,
      cropPlanId: p.cropPlanId,
      fieldId: p.fieldId,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.acres += r.acres;
      acc.yieldKg += r.yieldKg;
      acc.revenuePkr += r.revenuePkr;
      acc.totalCostPkr += r.totalCostPkr;
      acc.grossMarginPkr += r.grossMarginPkr;
      return acc;
    },
    { acres: 0, yieldKg: 0, revenuePkr: 0, totalCostPkr: 0, grossMarginPkr: 0, weightedMarginPerAcrePkr: 0 },
  );
  totals.weightedMarginPerAcrePkr = totals.acres > 0
    ? Number((totals.grossMarginPkr / totals.acres).toFixed(2))
    : 0;

  const decisionApprovals = await db
    .select({
      occurredAt: approvalActions.occurredAt,
      action: approvalActions.action,
      actorRole: approvalActions.actorRole,
      comment: approvalActions.comment,
      approvalType: approvalRequests.approvalType,
      title: approvalRequests.title,
    })
    .from(approvalActions)
    .innerJoin(approvalRequests, eq(approvalActions.approvalRequestId, approvalRequests.id))
    .where(
      and(
        eq(approvalRequests.entityId, entityId),
        inArray(approvalRequests.approvalType, ['crop_sale', 'feasibility_study']),
      ),
    );

  const decisions: DecisionRow[] = decisionApprovals.map((d) => ({
    occurredAt: d.occurredAt.toISOString(),
    approvalType: d.approvalType,
    title: d.title,
    action: d.action,
    actorRole: d.actorRole,
    comment: d.comment ?? null,
  }));

  return { rows, costPools, totals, decisions, seasonLabel, entityId };
}
