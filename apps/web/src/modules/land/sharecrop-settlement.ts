'use server';
import { and, desc, eq, lte, gte, isNull, or } from 'drizzle-orm';
import {
  db,
  harvestRecords,
  cropPlans,
  fields,
  leaseContracts,
  sharecropSettlements,
} from '@zameen/db';

interface SettlementResult {
  ok: true;
  settlementId: string;
  landownerSharePkr: number;
  tenantSharePkr: number;
}
interface SettlementError {
  ok: false;
  error: string;
}

const SHARE_TENURES = ['sharecrop_in', 'sharecrop_out', 'musharka'];

/**
 * Compute and persist a sharecrop settlement for a harvest record. Walks
 * harvest -> crop plan -> field -> active sharecrop lease, applies the
 * landowner/tenant share split, and deducts any input-share contributions
 * already advanced by the landowner.
 *
 * Assumes a default sale price of PKR 0 unless callers pass `assumedRevenuePkr`
 * — typically called after the produce lot has a sale to plug in revenue.
 */
export async function computeSettlement(
  harvestRecordId: string,
  opts?: { assumedRevenuePkr?: number; deductionsPkr?: number },
): Promise<SettlementResult | SettlementError> {
  const [harvest] = await db
    .select()
    .from(harvestRecords)
    .where(eq(harvestRecords.id, harvestRecordId))
    .limit(1);
  if (!harvest) return { ok: false, error: 'Harvest record not found' };

  const [plan] = await db
    .select()
    .from(cropPlans)
    .where(eq(cropPlans.id, harvest.cropPlanId))
    .limit(1);
  if (!plan) return { ok: false, error: 'Crop plan not found' };

  const harvestDate = (harvest.harvestedOn instanceof Date
    ? harvest.harvestedOn
    : new Date(harvest.harvestedOn as unknown as string)
  ).toISOString().slice(0, 10);

  // Find active sharecrop lease for the field covering the harvest date
  const leases = await db
    .select()
    .from(leaseContracts)
    .where(
      and(
        eq(leaseContracts.fieldId, plan.fieldId),
        eq(leaseContracts.status, 'active'),
        lte(leaseContracts.startDate, harvestDate),
        or(isNull(leaseContracts.endDate), gte(leaseContracts.endDate, harvestDate)),
      ),
    )
    .orderBy(desc(leaseContracts.startDate))
    .limit(1);

  const lease = leases[0];
  if (!lease) return { ok: false, error: 'No active lease on field at harvest date' };
  if (!SHARE_TENURES.includes(lease.tenure)) {
    return { ok: false, error: `Lease tenure (${lease.tenure}) is not sharecrop` };
  }
  if (lease.sharePctLandowner == null || lease.sharePctTenant == null) {
    return { ok: false, error: 'Lease is missing share percentages' };
  }

  const grossProduceKg = Number(harvest.grossYieldKg);
  const grossRevenuePkr = Number(opts?.assumedRevenuePkr ?? 0);
  const inputShare = (lease.inputShareArrangement as Record<string, number> | null) ?? null;

  // Input-share deduction: if landowner advanced a share of inputs, deduct
  // from gross revenue before splitting. We use crop plan budget as a proxy
  // when actual cost allocations are not yet rolled up.
  let inputDeduction = 0;
  if (inputShare && plan.budgetPkr) {
    const budget = Number(plan.budgetPkr);
    const avg =
      ((inputShare.seedsPctLandowner ?? 0) +
        (inputShare.fertilizerPctLandowner ?? 0) +
        (inputShare.pesticidePctLandowner ?? 0) +
        (inputShare.irrigationPctLandowner ?? 0) +
        (inputShare.laborPctLandowner ?? 0)) /
      5;
    inputDeduction = Number(((budget * avg) / 100).toFixed(2));
  }

  const totalDeductions = Number(((opts?.deductionsPkr ?? 0) + inputDeduction).toFixed(2));
  const net = Math.max(0, grossRevenuePkr - totalDeductions);
  const landownerPct = Number(lease.sharePctLandowner);
  const tenantPct = Number(lease.sharePctTenant);
  const landownerSharePkr = Number(((net * landownerPct) / 100).toFixed(2));
  const tenantSharePkr = Number((net - landownerSharePkr).toFixed(2));

  const [row] = await db
    .insert(sharecropSettlements)
    .values({
      leaseId: lease.id,
      cropPlanId: plan.id,
      harvestRecordId: harvest.id,
      settledOn: harvestDate,
      grossProduceKg: grossProduceKg.toString(),
      grossRevenuePkr: grossRevenuePkr.toString(),
      deductionsPkr: totalDeductions.toString(),
      landownerSharePkr: landownerSharePkr.toString(),
      tenantSharePkr: tenantSharePkr.toString(),
      notes: inputDeduction > 0 ? `Input-share deduction: PKR ${inputDeduction}` : null,
    })
    .returning();

  return { ok: true, settlementId: row!.id, landownerSharePkr, tenantSharePkr };
}

// Silence unused import in some build modes
void fields;
