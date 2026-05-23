import { eq } from 'drizzle-orm';
import {
  db,
  processingRecipes,
  processingRuns,
  byproductInventory,
  produceLots,
  type RunInputUsed,
  type RunOutputProduced,
} from '@zameen/db';
import { allocateCost } from './cost-allocation.js';

export interface ExecuteRunInput {
  recipeId: string;
  startedAt: string;
  endedAt?: string;
  inputs: RunInputUsed[];
  outputs: RunOutputProduced[];
  byproducts?: Array<{
    kind: string;
    quantityKg: number;
    unitValuePkr?: number;
    storageLocationId?: string;
  }>;
  energyKwh?: number;
  energyRatePkrPerKwh?: number;
  labourMinutes?: number;
  labourRatePkrPerHour?: number;
  overheadPkr?: number;
  operatorId?: string;
  notes?: string;
}

export interface ExecuteRunResult {
  runId: string;
  totalInputCostPkr: number;
  energyCostPkr: number;
  labourCostPkr: number;
  overheadCostPkr: number;
  byproductCreditPkr: number;
  netAllocatableCostPkr: number;
  totalRunCostPkr: number;
  actualYieldPct: number;
  expectedYieldPct: number | null;
  variancePct: number | null;
  perUnitOutputCostPkr: Record<string, number>;
  inefficiencyFlag: boolean;
}

const VARIANCE_FLAG_THRESHOLD_PCT = 5;

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Execute a processing run.
 *
 * Costing uses the byproduct-credit method: total input + energy + labour +
 * overhead minus the realisable byproduct value is divided across main outputs
 * pro-rata by mass. The actual yield is the sum of main-output mass over input
 * mass; variance is compared to the recipe's expected yield. A variance worse
 * than 5pp flags inefficiency.
 *
 * Side effects:
 *   - Inserts a processing_runs row.
 *   - Inserts byproduct_inventory rows (status 'still_held').
 *   - Creates produce_lots rows for each main output with cost_of_goods_pkr.
 *   - Posts cost allocations for inputs consumed under cost_pool 'processing'.
 */
export async function executeRun(input: ExecuteRunInput): Promise<ExecuteRunResult> {
  const [recipe] = await db
    .select()
    .from(processingRecipes)
    .where(eq(processingRecipes.id, input.recipeId))
    .limit(1);
  if (!recipe) throw new Error('Recipe not found');

  const totalInputMassKg = input.inputs.reduce((s, i) => s + i.quantityKg, 0);
  const totalOutputMassKg = input.outputs.reduce((s, o) => s + o.quantityKg, 0);
  if (totalInputMassKg <= 0) throw new Error('Inputs must have positive mass');

  const totalInputCostPkr = round2(
    input.inputs.reduce((s, i) => s + i.quantityKg * i.unitCostPkr, 0),
  );
  const energyCostPkr = round2(
    (input.energyKwh ?? 0) * (input.energyRatePkrPerKwh ?? 0),
  );
  const labourCostPkr = round2(
    ((input.labourMinutes ?? 0) / 60) * (input.labourRatePkrPerHour ?? 0),
  );
  const overheadCostPkr = round2(input.overheadPkr ?? 0);

  const byproductCreditPkr = round2(
    (input.byproducts ?? []).reduce(
      (s, b) => s + b.quantityKg * (b.unitValuePkr ?? 0),
      0,
    ),
  );

  const grossCostPkr = totalInputCostPkr + energyCostPkr + labourCostPkr + overheadCostPkr;
  const netAllocatableCostPkr = round2(grossCostPkr - byproductCreditPkr);

  const perUnitOutputCostPkr: Record<string, number> = {};
  for (const out of input.outputs) {
    if (totalOutputMassKg <= 0) {
      perUnitOutputCostPkr[out.name] = 0;
      continue;
    }
    const share = out.quantityKg / totalOutputMassKg;
    const allocated = netAllocatableCostPkr * share;
    perUnitOutputCostPkr[out.name] = round2(allocated / out.quantityKg);
  }

  const actualYieldPct = round2((totalOutputMassKg / totalInputMassKg) * 100);
  const expectedYieldPct = recipe.expectedTotalYieldPct
    ? Number(recipe.expectedTotalYieldPct)
    : null;
  const variancePct = expectedYieldPct !== null
    ? round2(actualYieldPct - expectedYieldPct)
    : null;
  const inefficiencyFlag = variancePct !== null && variancePct < -VARIANCE_FLAG_THRESHOLD_PCT;

  const startedAt = new Date(input.startedAt);
  const endedAt = input.endedAt ? new Date(input.endedAt) : null;
  const durationHours = endedAt
    ? round2((endedAt.getTime() - startedAt.getTime()) / 3_600_000)
    : null;

  const [runRow] = await db
    .insert(processingRuns)
    .values({
      entityId: recipe.entityId,
      recipeId: recipe.id,
      startedAt,
      endedAt,
      durationHours: durationHours !== null ? durationHours.toString() : null,
      inputsUsed: input.inputs,
      outputsProduced: input.outputs,
      actualYieldPct: actualYieldPct.toString(),
      varianceFromExpectedPct: variancePct !== null ? variancePct.toString() : null,
      totalInputCostPkr: totalInputCostPkr.toString(),
      energyCostPkr: energyCostPkr.toString(),
      labourCostPkr: labourCostPkr.toString(),
      overheadCostPkr: overheadCostPkr.toString(),
      totalRunCostPkr: grossCostPkr.toString(),
      perUnitOutputCostPkr,
      operatorId: input.operatorId,
      notes: input.notes,
    })
    .returning({ id: processingRuns.id });

  if (!runRow) throw new Error('Insert failed');

  if (input.byproducts && input.byproducts.length > 0) {
    await db.insert(byproductInventory).values(
      input.byproducts.map((b) => ({
        processingRunId: runRow.id,
        byproductKind: b.kind,
        quantityKg: b.quantityKg.toString(),
        unitValuePkr: b.unitValuePkr !== undefined ? b.unitValuePkr.toString() : null,
        storageLocationId: b.storageLocationId,
        disposalKind: 'still_held' as const,
      })),
    );
  }

  // Mint produce lots for the main outputs at the computed unit cost.
  for (const out of input.outputs) {
    const unitCost = perUnitOutputCostPkr[out.name] ?? 0;
    const totalCogs = round2(unitCost * out.quantityKg);
    await db.insert(produceLots).values({
      entityId: recipe.entityId,
      lotNumber: `RUN-${runRow.id.slice(0, 8)}-${out.name.toUpperCase().slice(0, 8)}`,
      cropName: out.name,
      grade: out.grade ?? 'a',
      netWeightKg: out.quantityKg.toString(),
      storageLocationId: out.storageLocationId,
      receivedOn: startedAt,
      costOfGoodsPkr: totalCogs.toString(),
      status: 'on_hand',
    });
  }

  // Post one cost allocation per input consumed, tagged to the processing module.
  for (const used of input.inputs) {
    const amt = round2(used.quantityKg * used.unitCostPkr);
    if (amt <= 0) continue;
    await allocateCost({
      entityId: recipe.entityId,
      sourceModule: 'other',
      sourceRecordId: runRow.id,
      costPool: 'processing' as never,
      amountPkr: amt,
      allocatedOn: startedAt.toISOString().slice(0, 10),
      notes: `Processing run ${runRow.id} - input ${used.crop}`,
    });
  }

  return {
    runId: runRow.id,
    totalInputCostPkr,
    energyCostPkr,
    labourCostPkr,
    overheadCostPkr,
    byproductCreditPkr,
    netAllocatableCostPkr,
    totalRunCostPkr: grossCostPkr,
    actualYieldPct,
    expectedYieldPct,
    variancePct,
    perUnitOutputCostPkr,
    inefficiencyFlag,
  };
}
