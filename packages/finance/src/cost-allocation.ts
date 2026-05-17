import { db, costAllocations } from '@zameen/db';
import type { CostPool } from '@zameen/shared';

export interface AllocateInput {
  entityId: string;
  sourceModule: 'diesel' | 'repair' | 'input' | 'labor' | 'irrigation' | 'feed' | 'vet' | 'admin' | 'other';
  sourceRecordId: string;
  costPool: CostPool;
  amountPkr: number;
  allocatedOn: string;
  fieldId?: string;
  cropPlanId?: string;
  assetId?: string;
  allocationKey?: string;
  notes?: string;
}

/**
 * Append a cost allocation row. One source record can produce multiple
 * allocations (e.g. diesel split across fields by hours-on-field).
 */
export async function allocateCost(input: AllocateInput): Promise<void> {
  await db.insert(costAllocations).values({
    entityId: input.entityId,
    sourceModule: input.sourceModule,
    sourceRecordId: input.sourceRecordId,
    costPool: input.costPool,
    amountPkr: input.amountPkr.toString(),
    allocatedOn: input.allocatedOn,
    fieldId: input.fieldId,
    cropPlanId: input.cropPlanId,
    assetId: input.assetId,
    allocationKey: input.allocationKey,
    notes: input.notes,
  });
}

/** Split an amount across fields proportional to weights (e.g. hours-on-field). */
export function proportionalSplit(
  totalPkr: number,
  weights: Array<{ fieldId: string; weight: number }>,
): Array<{ fieldId: string; amountPkr: number }> {
  const sum = weights.reduce((a, b) => a + b.weight, 0);
  if (sum <= 0) return [];
  const out = weights.map((w) => ({ fieldId: w.fieldId, amountPkr: Number(((totalPkr * w.weight) / sum).toFixed(2)) }));
  const drift = Number((totalPkr - out.reduce((a, b) => a + b.amountPkr, 0)).toFixed(2));
  if (out.length > 0) out[0]!.amountPkr = Number((out[0]!.amountPkr + drift).toFixed(2));
  return out;
}
