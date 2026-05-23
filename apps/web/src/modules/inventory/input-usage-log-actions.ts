'use server';
import { revalidatePath } from 'next/cache';
import { and, between, desc, eq, inArray } from 'drizzle-orm';
import {
  db,
  inputs,
  inputPurchases,
  inputIssuances,
  fields,
  blocks,
  farms,
  cropPlans,
  cropProfiles,
} from '@zameen/db';
import { createInputIssuance } from './actions';
import { getSessionContext } from '@/lib/session';

export type InputType =
  | 'seed'
  | 'fertilizer'
  | 'pesticide'
  | 'herbicide'
  | 'fungicide'
  | 'fuel'
  | 'packaging'
  | 'other';

export interface InputUsageCell {
  qty: number;
  totalPkr: number;
  unit: string;
  phiFlag?: boolean;
  rateFlag?: boolean;
}

export interface InputUsageRow {
  date: string;
  perField: Record<string, InputUsageCell>;
  perInput: Record<string, InputUsageCell>;
  totalPkr: number;
}

export interface InputUsageInputMeta {
  id: string;
  name: string;
  nameUr: string | null;
  unit: string;
  preHarvestIntervalDays?: number | null;
  activeIngredient?: string | null;
  epaClass?: string | null;
}

export interface InputUsageFieldMeta {
  id: string;
  code: string;
  name: string | null;
  acres: number;
  plannedHarvestDate?: string | null;
  recommendedSeedingRateKgPerAcre?: number | null;
}

export interface InputUsageLogData {
  inputType: InputType;
  fromDate: string;
  toDate: string;
  fields: InputUsageFieldMeta[];
  inputs: InputUsageInputMeta[];
  rows: InputUsageRow[];
  fieldTotals: Record<string, number>;
  inputTotals: Record<string, number>;
  grandTotalPkr: number;
}

export async function loadInputUsageLog({
  entityId,
  fromDate,
  toDate,
  inputType,
}: {
  entityId: string;
  fromDate: string;
  toDate: string;
  inputType: InputType;
}): Promise<InputUsageLogData> {
  const farmRows = await db
    .select({ farmId: farms.id })
    .from(farms)
    .where(eq(farms.entityId, entityId));
  const farmIds = farmRows.map((r) => r.farmId);

  const blockRows = farmIds.length
    ? await db.select({ blockId: blocks.id }).from(blocks).where(inArray(blocks.farmId, farmIds))
    : [];
  const blockIds = blockRows.map((r) => r.blockId);

  const fieldRows = blockIds.length
    ? await db
        .select({ id: fields.id, code: fields.code, name: fields.name, acres: fields.acres })
        .from(fields)
        .where(inArray(fields.blockId, blockIds))
    : [];
  const fieldIds = fieldRows.map((f) => f.id);

  const planRows = fieldIds.length
    ? await db
        .select({
          fieldId: cropPlans.fieldId,
          plannedHarvestDate: cropPlans.plannedHarvestDate,
          recommendedSeedingRateKgPerAcre: cropProfiles.recommendedSeedingRateKgPerAcre,
          status: cropPlans.status,
        })
        .from(cropPlans)
        .leftJoin(cropProfiles, eq(cropPlans.cropProfileId, cropProfiles.id))
        .where(inArray(cropPlans.fieldId, fieldIds))
    : [];
  const planByField = new Map<string, { plannedHarvestDate: string | null; recommendedSeedingRateKgPerAcre: number | null }>();
  for (const p of planRows) {
    if (p.status !== 'active' && p.status !== 'planned') continue;
    if (planByField.has(p.fieldId)) continue;
    planByField.set(p.fieldId, {
      plannedHarvestDate: p.plannedHarvestDate
        ? (p.plannedHarvestDate instanceof Date ? p.plannedHarvestDate : new Date(p.plannedHarvestDate)).toISOString()
        : null,
      recommendedSeedingRateKgPerAcre: p.recommendedSeedingRateKgPerAcre != null
        ? Number(p.recommendedSeedingRateKgPerAcre)
        : null,
    });
  }

  const typedInputs = await db
    .select({
      id: inputs.id,
      name: inputs.name,
      nameUr: inputs.nameUr,
      unit: inputs.unit,
      preHarvestIntervalDays: inputs.preHarvestIntervalDays,
      activeIngredient: inputs.activeIngredient,
      epaClass: inputs.epaClass,
    })
    .from(inputs)
    .where(and(eq(inputs.entityId, entityId), eq(inputs.type, inputType)));
  const inputIds = typedInputs.map((i) => i.id);

  const issuanceRows = (inputIds.length && fieldIds.length)
    ? await db
        .select({
          issuedOn: inputIssuances.issuedOn,
          fieldId: inputIssuances.fieldId,
          inputId: inputIssuances.inputId,
          quantity: inputIssuances.quantity,
          totalCostPkr: inputIssuances.totalCostPkr,
        })
        .from(inputIssuances)
        .where(
          and(
            inArray(inputIssuances.inputId, inputIds),
            inArray(inputIssuances.fieldId, fieldIds),
            between(inputIssuances.issuedOn, new Date(fromDate), new Date(`${toDate}T23:59:59Z`)),
          ),
        )
    : [];

  const inputMetaById = new Map<string, InputUsageInputMeta>(
    typedInputs.map((i) => [i.id, {
      id: i.id,
      name: i.name,
      nameUr: i.nameUr,
      unit: i.unit,
      preHarvestIntervalDays: i.preHarvestIntervalDays != null ? Number(i.preHarvestIntervalDays) : null,
      activeIngredient: i.activeIngredient,
      epaClass: i.epaClass,
    }]),
  );
  const fieldAcresById = new Map<string, number>(fieldRows.map((f) => [f.id, Number(f.acres)]));
  const byDate = new Map<string, InputUsageRow>();
  const fieldTotals: Record<string, number> = {};
  const inputTotals: Record<string, number> = {};
  let grand = 0;

  for (const r of issuanceRows) {
    if (!r.fieldId) continue;
    const issued = r.issuedOn instanceof Date ? r.issuedOn : new Date(r.issuedOn);
    const d = issued.toISOString().slice(0, 10);
    const qty = Number(r.quantity);
    const total = Number(r.totalCostPkr);
    const meta = inputMetaById.get(r.inputId);
    const unit = meta?.unit ?? 'kg';

    let phiFlag = false;
    let rateFlag = false;
    if (inputType === 'pesticide' && meta?.preHarvestIntervalDays != null) {
      const plan = planByField.get(r.fieldId);
      if (plan?.plannedHarvestDate) {
        const harvest = new Date(plan.plannedHarvestDate);
        const daysToHarvest = (harvest.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24);
        if (daysToHarvest >= 0 && daysToHarvest < meta.preHarvestIntervalDays) {
          phiFlag = true;
        }
      }
    }
    if (inputType === 'seed') {
      const plan = planByField.get(r.fieldId);
      const acres = fieldAcresById.get(r.fieldId) ?? 0;
      if (plan?.recommendedSeedingRateKgPerAcre && acres > 0) {
        const actualRate = qty / acres;
        const rec = plan.recommendedSeedingRateKgPerAcre;
        const lo = rec * 0.7;
        const hi = rec * 1.3;
        if (actualRate < lo || actualRate > hi) rateFlag = true;
      }
    }

    let row = byDate.get(d);
    if (!row) {
      row = { date: d, perField: {}, perInput: {}, totalPkr: 0 };
      byDate.set(d, row);
    }

    const fCell = row.perField[r.fieldId] ?? { qty: 0, totalPkr: 0, unit };
    fCell.qty += qty;
    fCell.totalPkr += total;
    if (phiFlag) fCell.phiFlag = true;
    if (rateFlag) fCell.rateFlag = true;
    row.perField[r.fieldId] = fCell;

    const iCell = row.perInput[r.inputId] ?? { qty: 0, totalPkr: 0, unit };
    iCell.qty += qty;
    iCell.totalPkr += total;
    row.perInput[r.inputId] = iCell;

    row.totalPkr += total;
    fieldTotals[r.fieldId] = (fieldTotals[r.fieldId] ?? 0) + total;
    inputTotals[r.inputId] = (inputTotals[r.inputId] ?? 0) + total;
    grand += total;
  }

  const rows = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    inputType,
    fromDate,
    toDate,
    fields: fieldRows.map((f) => {
      const plan = planByField.get(f.id);
      return {
        id: f.id,
        code: f.code,
        name: f.name,
        acres: Number(f.acres),
        plannedHarvestDate: plan?.plannedHarvestDate ?? null,
        recommendedSeedingRateKgPerAcre: plan?.recommendedSeedingRateKgPerAcre ?? null,
      };
    }),
    inputs: typedInputs.map((i) => ({
      id: i.id,
      name: i.name,
      nameUr: i.nameUr,
      unit: i.unit,
      preHarvestIntervalDays: i.preHarvestIntervalDays != null ? Number(i.preHarvestIntervalDays) : null,
      activeIngredient: i.activeIngredient,
      epaClass: i.epaClass,
    })),
    rows,
    fieldTotals,
    inputTotals,
    grandTotalPkr: grand,
  };
}

export async function getLatestUnitCost(inputId: string): Promise<number | null> {
  const [row] = await db
    .select({ unitPricePkr: inputPurchases.unitPricePkr })
    .from(inputPurchases)
    .where(eq(inputPurchases.inputId, inputId))
    .orderBy(desc(inputPurchases.purchasedOn))
    .limit(1);
  return row ? Number(row.unitPricePkr) : null;
}

export interface QuickIssueArgs {
  entityId: string;
  fieldId: string;
  inputId: string;
  cropPlanId?: string;
  issuedOn: string;
  quantity: number;
  unitCostPkr: number;
  notes?: string;
  revalidate?: string;
}

export async function quickIssueInput(args: QuickIssueArgs): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const totalCostPkr = +(args.quantity * args.unitCostPkr).toFixed(2);
  const payload = {
    entityId: args.entityId,
    inputId: args.inputId,
    fieldId: args.fieldId,
    cropPlanId: args.cropPlanId,
    issuedOn: args.issuedOn,
    quantity: args.quantity,
    unitCostPkr: args.unitCostPkr,
    totalCostPkr,
    notes: args.notes,
  };

  const res = await createInputIssuance(payload);
  if (!res.ok) return { ok: false, error: res.error };
  if (args.revalidate) revalidatePath(args.revalidate);
  revalidatePath('/inventory/inputs');
  return { ok: true };
}
