'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import {
  inputCreateSchema,
  inputPurchaseSchema,
  inputIssuanceSchema,
  produceMovementSchema,
  storageLocationCreateSchema,
  assetCreateSchema,
  assetHourMeterSchema,
} from '@zameen/shared/validators';
import { DEFAULT_APPROVAL_THRESHOLDS_PKR } from '@zameen/shared';
import type { CostPool } from '@zameen/shared';
import {
  db,
  inputs,
  inputPurchases,
  inputIssuances,
  produceMovements,
  storageLocations,
  assets,
  assetHourMeters,
} from '@zameen/db';
import { submitApproval, buildFullContext } from '@zameen/approvals';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function createInput(raw: unknown): Promise<Result> {
  const parsed = inputCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(inputs)
    .values({
      entityId: d.entityId,
      type: d.type,
      name: d.name,
      nameUr: d.nameUr ?? null,
      brand: d.brand ?? null,
      unit: d.unit,
      unitSizeKg: d.unitSizeKg?.toString() ?? null,
      expiryTracked: d.expiryTracked,
      reorderPoint: d.reorderPoint?.toString() ?? null,
      notes: d.notes ?? null,
    })
    .returning();
  revalidatePath('/inventory/inputs');
  return { ok: true, id: row!.id };
}

export async function createInputPurchase(raw: unknown): Promise<Result> {
  const parsed = inputPurchaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;

  const [row] = await db
    .insert(inputPurchases)
    .values({
      entityId: d.entityId,
      inputId: d.inputId,
      vendorId: d.vendorId ?? null,
      purchasedOn: new Date(d.purchasedOn),
      quantity: d.quantity.toString(),
      unitPricePkr: d.unitPricePkr.toString(),
      totalPkr: d.totalPkr.toString(),
      invoiceNumber: d.invoiceNumber ?? null,
      receiptPhotoUrls: d.receiptPhotoUrls,
      expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
      batchNumber: d.batchNumber ?? null,
      notes: d.notes ?? null,
      createdBy: ctx.userId,
    })
    .returning();

  const amount = Number(d.totalPkr);
  const t = DEFAULT_APPROVAL_THRESHOLDS_PKR.input_purchase;
  const needsApproval =
    (t.supervisor !== null && amount > t.supervisor) || (t.farm_manager !== null && amount > t.farm_manager);
  if (needsApproval) {
    const payload = { inputPurchaseId: row!.id, ...d };
    const contextSnapshot = await buildFullContext({
      entityId: d.entityId,
      approvalType: 'input_purchase',
      payload: payload as Record<string, unknown>,
      requesterUserId: ctx.userId,
      sourceModule: 'inventory',
    });
    await submitApproval({
      entityId: d.entityId,
      approvalType: 'input_purchase',
      sourceModule: 'inventory',
      sourceRecordId: row!.id,
      title: `Input purchase ${d.quantity} units`,
      amountPkr: amount,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }
  revalidatePath('/inventory/inputs/purchases');
  return { ok: true, id: row!.id };
}

const TYPE_TO_POOL: Record<string, CostPool> = {
  seed: 'seed',
  fertilizer: 'fertilizer',
  pesticide: 'pesticide',
  herbicide: 'pesticide',
  fungicide: 'pesticide',
  fuel: 'diesel',
  packaging: 'admin',
  other: 'admin',
};

export async function createInputIssuance(raw: unknown): Promise<Result> {
  const parsed = inputIssuanceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(inputIssuances)
    .values({
      inputId: d.inputId,
      fieldId: d.fieldId,
      cropPlanId: d.cropPlanId ?? null,
      issuedOn: new Date(d.issuedOn),
      quantity: d.quantity.toString(),
      unitCostPkr: d.unitCostPkr.toString(),
      totalCostPkr: d.totalCostPkr.toString(),
      issuedTo: ctx.userId,
      receivedBy: d.receivedBy ?? null,
      purpose: d.purpose ?? null,
      notes: d.notes ?? null,
    })
    .returning();

  const [inputRow] = await db.select({ type: inputs.type }).from(inputs).where(eq(inputs.id, d.inputId)).limit(1);
  const pool = (inputRow ? TYPE_TO_POOL[inputRow.type] : null) ?? 'admin';
  await allocateCost({
    entityId: d.entityId,
    sourceModule: 'input',
    sourceRecordId: row!.id,
    fieldId: d.fieldId,
    cropPlanId: d.cropPlanId ?? undefined,
    costPool: pool,
    amountPkr: d.totalCostPkr,
    allocatedOn: d.issuedOn.slice(0, 10),
    allocationKey: 'direct',
  });
  revalidatePath('/inventory/inputs');
  return { ok: true, id: row!.id };
}

export async function createProduceMovement(raw: unknown): Promise<Result> {
  const parsed = produceMovementSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(produceMovements)
    .values({
      produceLotId: d.produceLotId,
      fromLocationId: d.fromLocationId ?? null,
      toLocationId: d.toLocationId,
      quantityKg: d.quantityKg.toString(),
      reason: d.reason ?? null,
      movedBy: ctx.userId,
    })
    .returning();
  revalidatePath('/inventory/produce');
  return { ok: true, id: row!.id };
}

export async function createStorageLocation(raw: unknown): Promise<Result> {
  const parsed = storageLocationCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const d = parsed.data;
  const [row] = await db
    .insert(storageLocations)
    .values({
      entityId: d.entityId,
      code: d.code,
      name: d.name,
      kind: d.kind,
      capacityKg: d.capacityKg?.toString() ?? null,
    })
    .returning();
  revalidatePath('/inventory/produce/storage-locations');
  return { ok: true, id: row!.id };
}

export async function createAsset(raw: unknown): Promise<Result> {
  const parsed = assetCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(assets)
    .values({
      entityId: d.entityId,
      code: d.code,
      category: d.category,
      make: d.make ?? null,
      model: d.model ?? null,
      year: d.year ?? null,
      registrationNumber: d.registrationNumber ?? null,
      engineNumber: d.engineNumber ?? null,
      chassisNumber: d.chassisNumber ?? null,
      purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
      purchasePricePkr: d.purchasePricePkr.toString(),
      usefulLifeYears: d.usefulLifeYears ?? null,
      manufacturerFuelSpecLph: d.manufacturerFuelSpecLph?.toString() ?? null,
      currentHourMeter: d.currentHourMeter.toString(),
      notes: d.notes ?? null,
    })
    .returning();

  const amount = Number(d.purchasePricePkr);
  if (amount > 0) {
    const payload = { assetId: row!.id, ...d };
    const contextSnapshot = await buildFullContext({
      entityId: d.entityId,
      approvalType: 'asset_purchase',
      payload: payload as Record<string, unknown>,
      requesterUserId: ctx.userId,
      sourceModule: 'inventory',
    });
    await submitApproval({
      entityId: d.entityId,
      approvalType: 'asset_purchase',
      sourceModule: 'inventory',
      sourceRecordId: row!.id,
      title: `Asset purchase: ${d.make ?? ''} ${d.model ?? ''} (${d.category})`,
      amountPkr: amount,
      payload,
      contextSnapshot,
      requestedBy: ctx.userId,
      actorRole: ctx.role,
    });
  }
  revalidatePath('/inventory/assets');
  return { ok: true, id: row!.id };
}

export async function recordAssetHourMeter(raw: unknown): Promise<Result> {
  const parsed = assetHourMeterSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(assetHourMeters)
    .values({
      assetId: d.assetId,
      recordedOn: new Date(d.recordedOn),
      meterReading: d.meterReading.toString(),
      recordedBy: ctx.userId,
      source: d.source,
    })
    .returning();
  await db.update(assets).set({ currentHourMeter: d.meterReading.toString() }).where(eq(assets.id, d.assetId));
  revalidatePath(`/inventory/assets/${d.assetId}`);
  return { ok: true, id: row!.id };
}
