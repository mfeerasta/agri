import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  cropPlans,
  fields as fieldsTable,
  blocks as blocksTable,
  farms as farmsTable,
  cropProfiles,
  costAllocations,
  harvestRecords,
  mandiSettlements,
} from '@zameen/db';

export interface MatrixCell {
  cropPlanId: string;
  cropName: string;
  marginPerAcre: number;
  yieldPerAcre: number;
}

export interface MatrixRow {
  fieldId: string;
  fieldCode: string;
  acres: number;
  cells: Record<string, MatrixCell | null>; // key = seasonLabel
  latestMarginPerAcre: number;
}

export interface FieldMatrix {
  seasons: string[];
  rows: MatrixRow[];
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export async function buildFieldMatrix(entityId: string, years: number): Promise<FieldMatrix> {
  // Pull the most recent N season labels for this entity.
  const seasonRows = await db
    .select({ seasonLabel: cropPlans.seasonLabel, maxCreated: sql<string>`max(${cropPlans.createdAt})` })
    .from(cropPlans)
    .innerJoin(fieldsTable, eq(fieldsTable.id, cropPlans.fieldId))
    .innerJoin(blocksTable, eq(blocksTable.id, fieldsTable.blockId))
    .innerJoin(farmsTable, eq(farmsTable.id, blocksTable.farmId))
    .where(eq(farmsTable.entityId, entityId))
    .groupBy(cropPlans.seasonLabel)
    .orderBy(sql`max(${cropPlans.createdAt}) desc`)
    .limit(years);

  const seasons = seasonRows.map((s) => s.seasonLabel).reverse();
  if (seasons.length === 0) return { seasons: [], rows: [] };

  const planRows = await db
    .select({
      id: cropPlans.id,
      fieldId: cropPlans.fieldId,
      cropProfileId: cropPlans.cropProfileId,
      seasonLabel: cropPlans.seasonLabel,
      acres: cropPlans.plannedAcres,
    })
    .from(cropPlans)
    .innerJoin(fieldsTable, eq(fieldsTable.id, cropPlans.fieldId))
    .innerJoin(blocksTable, eq(blocksTable.id, fieldsTable.blockId))
    .innerJoin(farmsTable, eq(farmsTable.id, blocksTable.farmId))
    .where(and(inArray(cropPlans.seasonLabel, seasons), eq(farmsTable.entityId, entityId)));

  if (planRows.length === 0) return { seasons, rows: [] };

  const planIds = planRows.map((p) => p.id);
  const fieldIds = Array.from(new Set(planRows.map((p) => p.fieldId)));
  const [fields, profiles, costRows, harvestRows, revRows] = await Promise.all([
    db.select().from(fieldsTable).where(inArray(fieldsTable.id, fieldIds)),
    db.select().from(cropProfiles).where(inArray(cropProfiles.id, Array.from(new Set(planRows.map((p) => p.cropProfileId))))),
    db
      .select({
        cropPlanId: costAllocations.cropPlanId,
        total: sql<string>`coalesce(sum(${costAllocations.amountPkr}), 0)`,
      })
      .from(costAllocations)
      .where(inArray(costAllocations.cropPlanId, planIds))
      .groupBy(costAllocations.cropPlanId),
    db
      .select({
        cropPlanId: harvestRecords.cropPlanId,
        yieldKg: sql<string>`coalesce(sum(${harvestRecords.grossYieldKg}), 0)`,
      })
      .from(harvestRecords)
      .where(inArray(harvestRecords.cropPlanId, planIds))
      .groupBy(harvestRecords.cropPlanId),
    db
      .select({
        cropPlanId: mandiSettlements.approvalRequestId,
        net: sql<string>`coalesce(sum(${mandiSettlements.netReceivedPkr}), 0)`,
      })
      .from(mandiSettlements)
      .where(inArray(mandiSettlements.approvalRequestId, planIds))
      .groupBy(mandiSettlements.approvalRequestId),
  ]);

  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const costByPlan = new Map(costRows.map((r) => [r.cropPlanId as string, num(r.total)]));
  const yieldByPlan = new Map(harvestRows.map((r) => [r.cropPlanId, num(r.yieldKg)]));
  const revByPlan = new Map(revRows.map((r) => [r.cropPlanId as string, num(r.net)]));

  const rowByField = new Map<string, MatrixRow>();
  for (const p of planRows) {
    const f = fieldById.get(p.fieldId);
    if (!f) continue;
    const acres = num(p.acres);
    const cost = costByPlan.get(p.id) ?? 0;
    const rev = revByPlan.get(p.id) ?? 0;
    const yieldKg = yieldByPlan.get(p.id) ?? 0;
    const margin = rev - cost;
    const cell: MatrixCell = {
      cropPlanId: p.id,
      cropName: profileById.get(p.cropProfileId)?.name ?? 'Unknown',
      marginPerAcre: acres > 0 ? Number((margin / acres).toFixed(2)) : 0,
      yieldPerAcre: acres > 0 ? Number((yieldKg / acres).toFixed(2)) : 0,
    };
    const existing = rowByField.get(p.fieldId) ?? {
      fieldId: p.fieldId,
      fieldCode: f.code,
      acres: num(f.acres),
      cells: Object.fromEntries(seasons.map((s) => [s, null])) as Record<string, MatrixCell | null>,
      latestMarginPerAcre: 0,
    };
    existing.cells[p.seasonLabel] = cell;
    rowByField.set(p.fieldId, existing);
  }

  const latest = seasons[seasons.length - 1]!;
  const rows = Array.from(rowByField.values()).map((r) => ({
    ...r,
    latestMarginPerAcre: r.cells[latest]?.marginPerAcre ?? 0,
  }));
  rows.sort((a, b) => b.latestMarginPerAcre - a.latestMarginPerAcre);

  return { seasons, rows };
}
