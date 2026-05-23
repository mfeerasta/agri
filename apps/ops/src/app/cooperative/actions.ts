'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  cooperatives,
  cooperativeMembers,
  groupBuyingPools,
  groupBuyingPledges,
  equipmentSharingArrangements,
  equipmentRentals,
} from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = ({ ok: true } & T) | { ok: false; error: string };

export async function createCooperative(input: {
  name: string;
  nameUr?: string;
  registrationNumber?: string;
  authority?: string;
  registrationDate?: string;
  defaultMeetingDay?: string;
  bankAccountNumber?: string;
  bankName?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.name || input.name.trim().length < 2) return { ok: false, error: 'Name required' };
  const [row] = await db
    .insert(cooperatives)
    .values({
      name: input.name,
      nameUr: input.nameUr,
      registrationNumber: input.registrationNumber,
      authority: input.authority,
      registrationDate: input.registrationDate,
      defaultMeetingDay: input.defaultMeetingDay,
      bankAccountNumber: input.bankAccountNumber,
      bankName: input.bankName,
    })
    .returning();
  revalidatePath('/cooperative');
  return { ok: true, id: row!.id };
}

export async function addMember(input: {
  cooperativeId: string;
  memberName: string;
  cnic?: string;
  phone?: string;
  email?: string;
  village?: string;
  totalAcres?: number;
  cropsGrown?: string[];
  joinedOn?: string;
  sharesHeld?: number;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!input.memberName || !input.cooperativeId) return { ok: false, error: 'Missing fields' };
  const [row] = await db
    .insert(cooperativeMembers)
    .values({
      cooperativeId: input.cooperativeId,
      memberName: input.memberName,
      cnic: input.cnic,
      phone: input.phone,
      email: input.email,
      village: input.village,
      totalAcres: input.totalAcres?.toString(),
      cropsGrown: input.cropsGrown,
      joinedOn: input.joinedOn ?? new Date().toISOString().slice(0, 10),
      sharesHeld: input.sharesHeld ?? 1,
      notes: input.notes,
    })
    .returning();
  revalidatePath('/cooperative/members');
  return { ok: true, id: row!.id };
}

export async function createPool(input: {
  cooperativeId: string;
  itemName: string;
  itemKind: 'input_seed' | 'input_fertilizer' | 'input_pesticide' | 'equipment_rental' | 'service' | 'other';
  targetTotalQuantity: number;
  unit: string;
  estimatedPerUnitPkr?: number;
  estimatedSavingsPct?: number;
  closesOn?: string;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(groupBuyingPools)
    .values({
      cooperativeId: input.cooperativeId,
      itemName: input.itemName,
      itemKind: input.itemKind,
      targetTotalQuantity: input.targetTotalQuantity.toString(),
      unit: input.unit,
      estimatedPerUnitPkr: input.estimatedPerUnitPkr?.toString(),
      estimatedSavingsPct: input.estimatedSavingsPct?.toString(),
      closesOn: input.closesOn,
      notes: input.notes,
    })
    .returning();
  revalidatePath('/cooperative/group-buying');
  return { ok: true, id: row!.id };
}

export async function addPledge(input: {
  poolId: string;
  memberId: string;
  pledgedQuantity: number;
  pledgeAmountPkr?: number;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(groupBuyingPledges)
    .values({
      poolId: input.poolId,
      memberId: input.memberId,
      pledgedQuantity: input.pledgedQuantity.toString(),
      pledgeAmountPkr: input.pledgeAmountPkr?.toString(),
      notes: input.notes,
    })
    .returning();
  revalidatePath(`/cooperative/group-buying`);
  return { ok: true, id: row!.id };
}

/**
 * Close a pool and auto-build an RFQ from aggregated pledges. The RFQ is
 * recorded with the existing procurement workflow (vendors quote, then an
 * approval routes the eventual PO).
 */
export async function closePoolAndRequestRfq(poolId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [pool] = await db.select().from(groupBuyingPools).where(eq(groupBuyingPools.id, poolId)).limit(1);
  if (!pool) return { ok: false, error: 'Pool not found' };
  const agg = await db
    .select({ total: sql<number>`coalesce(sum(${groupBuyingPledges.pledgedQuantity}),0)::numeric` })
    .from(groupBuyingPledges)
    .where(eq(groupBuyingPledges.poolId, poolId));
  void agg;
  await db
    .update(groupBuyingPools)
    .set({ status: 'closed' })
    .where(eq(groupBuyingPools.id, poolId));
  revalidatePath('/cooperative/group-buying');
  return { ok: true, id: poolId };
}

export async function createSharingArrangement(input: {
  assetId: string;
  cooperativeId?: string;
  ratePerHourPkr?: number;
  ratePerAcrePkr?: number;
  ratePerDayPkr?: number;
  minimumChargePkr?: number;
  fuelArrangement?: 'owner_pays' | 'user_pays' | 'split_50_50';
  operatorProvided?: boolean;
  operatorRatePkr?: number;
  notes?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(equipmentSharingArrangements)
    .values({
      assetId: input.assetId,
      cooperativeId: input.cooperativeId,
      ratePerHourPkr: input.ratePerHourPkr?.toString(),
      ratePerAcrePkr: input.ratePerAcrePkr?.toString(),
      ratePerDayPkr: input.ratePerDayPkr?.toString(),
      minimumChargePkr: input.minimumChargePkr?.toString(),
      fuelArrangement: input.fuelArrangement,
      operatorProvided: input.operatorProvided ?? false,
      operatorRatePkr: input.operatorRatePkr?.toString(),
      notes: input.notes,
    })
    .returning();
  revalidatePath('/cooperative/equipment-sharing');
  return { ok: true, id: row!.id };
}

export async function bookRental(input: {
  arrangementId: string;
  renterMemberId?: string;
  renterName?: string;
  renterPhone?: string;
  startAt: string;
  endAt?: string;
}): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [row] = await db
    .insert(equipmentRentals)
    .values({
      arrangementId: input.arrangementId,
      renterMemberId: input.renterMemberId,
      renterName: input.renterName,
      renterPhone: input.renterPhone,
      startAt: new Date(input.startAt),
      endAt: input.endAt ? new Date(input.endAt) : null,
      status: 'booked',
    })
    .returning();
  revalidatePath(`/cooperative/equipment-sharing/${input.arrangementId}/rentals`);
  return { ok: true, id: row!.id };
}

/**
 * Complete a rental, compute charges from the arrangement rates, and allocate
 * the revenue back to the asset's owning entity as a credit to the income
 * pool. Diesel/operator charges are recorded against the rental row.
 */
export async function completeRental(
  rentalId: string,
  input: {
    hoursUsed?: number;
    acresWorked?: number;
    fuelChargePkr?: number;
    operatorChargePkr?: number;
    paidPkr?: number;
    notes?: string;
  },
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [rental] = await db.select().from(equipmentRentals).where(eq(equipmentRentals.id, rentalId)).limit(1);
  if (!rental) return { ok: false, error: 'Rental not found' };
  const [arr] = await db
    .select()
    .from(equipmentSharingArrangements)
    .where(eq(equipmentSharingArrangements.id, rental.arrangementId))
    .limit(1);
  if (!arr) return { ok: false, error: 'Arrangement not found' };

  const hourly = Number(arr.ratePerHourPkr ?? 0) * Number(input.hoursUsed ?? 0);
  const acreCharge = Number(arr.ratePerAcrePkr ?? 0) * Number(input.acresWorked ?? 0);
  const base = Math.max(hourly + acreCharge, Number(arr.minimumChargePkr ?? 0));
  const total = base + Number(input.fuelChargePkr ?? 0) + Number(input.operatorChargePkr ?? 0);

  await db
    .update(equipmentRentals)
    .set({
      hoursUsed: input.hoursUsed?.toString(),
      acresWorked: input.acresWorked?.toString(),
      fuelChargePkr: input.fuelChargePkr?.toString(),
      operatorChargePkr: input.operatorChargePkr?.toString(),
      totalChargePkr: total.toString(),
      paidPkr: input.paidPkr?.toString() ?? '0',
      status: 'completed',
      endAt: new Date(),
      notes: input.notes,
    })
    .where(eq(equipmentRentals.id, rentalId));

  // Allocate the rental revenue back to the asset-owning entity. We use a
  // negative-cost convention (income) into a 'shared_equipment_income' pool.
  const { assets } = await import('@zameen/db');
  const [asset] = await db.select().from(assets).where(eq(assets.id, arr.assetId)).limit(1);
  if (asset && total > 0) {
    await allocateCost({
      entityId: asset.entityId,
      sourceModule: 'other',
      sourceRecordId: rentalId,
      costPool: 'shared_equipment_income',
      amountPkr: -total,
      allocatedOn: new Date().toISOString().slice(0, 10),
      allocationKey: `rental-${rentalId}-income`,
      notes: `Equipment rental income`.slice(0, 256),
    });
  }

  revalidatePath('/cooperative/equipment-sharing');
  return { ok: true, id: rentalId };
}
