'use server';
import { revalidatePath } from 'next/cache';
import { and, between, desc, eq, sql } from 'drizzle-orm';
import { db, animals, feedIssuances, inputPurchases, inputs, livestockHerds } from '@zameen/db';
import { allocateCost } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export interface FeedColumn {
  id: string;
  kind: 'animal' | 'herd';
  label: string;
  labelUr: string | null;
}

export interface FeedCell {
  qty: number;
  totalPkr: number;
  unit: string;
}

export interface FeedRow {
  date: string;
  cells: Record<string, FeedCell>;
  total: number;
}

export interface FeedMatrix {
  fromDate: string;
  toDate: string;
  columns: FeedColumn[];
  inputs: Array<{ id: string; name: string; nameUr: string | null; unit: string }>;
  rows: FeedRow[];
  columnTotals: Record<string, number>;
  inputTotals: Record<string, number>;
  grandTotal: number;
}

export async function loadFeedMatrix(args: {
  entityId: string;
  fromDate: string;
  toDate: string;
}): Promise<FeedMatrix> {
  const { entityId, fromDate, toDate } = args;

  const herdRows = await db
    .select({ id: livestockHerds.id, name: livestockHerds.name, nameUr: livestockHerds.nameUr })
    .from(livestockHerds)
    .where(eq(livestockHerds.entityId, entityId));

  const animalRows = await db
    .select({ id: animals.id, earTag: animals.earTag })
    .from(animals)
    .where(and(eq(animals.entityId, entityId), eq(animals.status, 'active')));

  const columns: FeedColumn[] = [
    ...herdRows.map<FeedColumn>((h) => ({ id: h.id, kind: 'herd', label: h.name, labelUr: h.nameUr })),
    ...animalRows.map<FeedColumn>((a) => ({ id: a.id, kind: 'animal', label: a.earTag, labelUr: null })),
  ];

  const feedInputs = await db
    .select({ id: inputs.id, name: inputs.name, nameUr: inputs.nameUr, unit: inputs.unit })
    .from(inputs)
    .where(and(eq(inputs.entityId, entityId), eq(inputs.type, 'feed')));

  const issuanceRows = await db
    .select({
      issuedOn: feedIssuances.issuedOn,
      animalId: feedIssuances.animalId,
      herdId: feedIssuances.herdId,
      inputId: feedIssuances.inputId,
      quantity: feedIssuances.quantity,
      totalCostPkr: feedIssuances.totalCostPkr,
    })
    .from(feedIssuances)
    .where(
      and(
        eq(feedIssuances.entityId, entityId),
        between(feedIssuances.issuedOn, new Date(fromDate), new Date(`${toDate}T23:59:59Z`)),
      ),
    );

  const inputMeta = new Map(feedInputs.map((i) => [i.id, i]));
  const byDate = new Map<string, FeedRow>();
  const columnTotals: Record<string, number> = {};
  const inputTotals: Record<string, number> = {};
  let grand = 0;

  for (const r of issuanceRows) {
    const key = r.animalId ?? r.herdId;
    if (!key) continue;
    const d = (r.issuedOn instanceof Date ? r.issuedOn : new Date(r.issuedOn)).toISOString().slice(0, 10);
    let row = byDate.get(d);
    if (!row) {
      row = { date: d, cells: {}, total: 0 };
      byDate.set(d, row);
    }
    const unit = inputMeta.get(r.inputId)?.unit ?? 'kg';
    const cell = row.cells[key] ?? { qty: 0, totalPkr: 0, unit };
    cell.qty += Number(r.quantity);
    cell.totalPkr += Number(r.totalCostPkr);
    row.cells[key] = cell;
    row.total += Number(r.totalCostPkr);
    columnTotals[key] = (columnTotals[key] ?? 0) + Number(r.totalCostPkr);
    inputTotals[r.inputId] = (inputTotals[r.inputId] ?? 0) + Number(r.totalCostPkr);
    grand += Number(r.totalCostPkr);
  }

  const rows = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    fromDate,
    toDate,
    columns,
    inputs: feedInputs,
    rows,
    columnTotals,
    inputTotals,
    grandTotal: grand,
  };
}

export interface IssueFeedArgs {
  entityId: string;
  inputId: string;
  herdId?: string;
  animalId?: string;
  issuedOn: string;
  quantity: number;
  unitCostPkr: number;
  notes?: string;
  revalidate?: string;
}

export async function issueFeed(args: IssueFeedArgs): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!args.herdId && !args.animalId) return { ok: false, error: 'herdId or animalId required' };
  if (!(args.quantity > 0)) return { ok: false, error: 'quantity must be positive' };

  const totalCostPkr = +(args.quantity * args.unitCostPkr).toFixed(2);

  const [inserted] = await db
    .insert(feedIssuances)
    .values({
      entityId: args.entityId,
      inputId: args.inputId,
      herdId: args.herdId,
      animalId: args.animalId,
      issuedOn: new Date(args.issuedOn),
      quantity: args.quantity.toString(),
      unitCostPkr: args.unitCostPkr.toString(),
      totalCostPkr: totalCostPkr.toString(),
      notes: args.notes,
      createdBy: ctx.userId,
    })
    .returning({ id: feedIssuances.id });

  if (inserted) {
    await allocateCost({
      entityId: args.entityId,
      sourceModule: 'feed',
      sourceRecordId: inserted.id,
      costPool: 'feed',
      amountPkr: totalCostPkr,
      allocatedOn: args.issuedOn.slice(0, 10),
      notes: args.notes,
    });
  }

  if (args.revalidate) revalidatePath(args.revalidate);
  revalidatePath('/livestock/feed-log');
  return { ok: true };
}

export async function getLatestFeedUnitCost(inputId: string): Promise<number | null> {
  const [row] = await db
    .select({ unitPricePkr: inputPurchases.unitPricePkr })
    .from(inputPurchases)
    .where(eq(inputPurchases.inputId, inputId))
    .orderBy(desc(inputPurchases.purchasedOn))
    .limit(1);
  return row ? Number(row.unitPricePkr) : null;
}

export async function lifetimeFeedCostForAnimal(animalId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${feedIssuances.totalCostPkr}), 0)` })
    .from(feedIssuances)
    .where(eq(feedIssuances.animalId, animalId));
  return Number(row?.total ?? 0);
}
