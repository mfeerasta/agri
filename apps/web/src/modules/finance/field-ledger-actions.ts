'use server';
import { and, between, eq, inArray } from 'drizzle-orm';
import { db, costAllocations, fields, blocks, farms } from '@zameen/db';
import type { CostPool } from '@zameen/shared';

export interface FieldLedgerCell {
  byPool: Partial<Record<CostPool, number>>;
  totalPkr: number;
}

export interface FieldLedgerRow {
  date: string;
  perField: Record<string, FieldLedgerCell>;
  byPool: Partial<Record<CostPool, number>>;
  totalPkr: number;
}

export interface FieldLedgerFieldTotal {
  byPool: Partial<Record<CostPool, number>>;
  totalPkr: number;
  perAcrePkr: number;
}

export interface FieldLedgerData {
  fromDate: string;
  toDate: string;
  fields: Array<{ id: string; code: string; name: string | null; acres: number }>;
  rows: FieldLedgerRow[];
  fieldTotals: Record<string, FieldLedgerFieldTotal>;
  poolTotals: Partial<Record<CostPool, number>>;
  grandTotalPkr: number;
}

export interface LedgerSourceRecord {
  id: string;
  sourceModule: string;
  sourceRecordId: string;
  costPool: CostPool;
  amountPkr: number;
  notes: string | null;
  allocatedOn: string;
}

/**
 * One mega-pivot from cost_allocations. This is the single source of truth
 * since every cost-bearing action funnels through allocateCost() with a
 * field_id + cost_pool tag.
 */
export async function loadFieldLedger({
  entityId,
  fromDate,
  toDate,
}: {
  entityId: string;
  fromDate: string;
  toDate: string;
}): Promise<FieldLedgerData> {
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

  const allocs = await db
    .select({
      costPool: costAllocations.costPool,
      fieldId: costAllocations.fieldId,
      amountPkr: costAllocations.amountPkr,
      allocatedOn: costAllocations.allocatedOn,
    })
    .from(costAllocations)
    .where(
      and(
        eq(costAllocations.entityId, entityId),
        between(costAllocations.allocatedOn, fromDate, toDate),
      ),
    );

  const byDate = new Map<string, FieldLedgerRow>();
  const fieldTotals: Record<string, FieldLedgerFieldTotal> = {};
  const poolTotals: Partial<Record<CostPool, number>> = {};
  let grand = 0;

  for (const a of allocs) {
    if (!a.fieldId) continue; // skip unassigned overhead for the per-field grid
    const d = (a.allocatedOn instanceof Date ? a.allocatedOn : new Date(a.allocatedOn))
      .toISOString()
      .slice(0, 10);
    const amt = Number(a.amountPkr);
    const pool = a.costPool as CostPool;

    let row = byDate.get(d);
    if (!row) {
      row = { date: d, perField: {}, byPool: {}, totalPkr: 0 };
      byDate.set(d, row);
    }

    const cell = row.perField[a.fieldId] ?? { byPool: {}, totalPkr: 0 };
    cell.byPool[pool] = (cell.byPool[pool] ?? 0) + amt;
    cell.totalPkr += amt;
    row.perField[a.fieldId] = cell;
    row.byPool[pool] = (row.byPool[pool] ?? 0) + amt;
    row.totalPkr += amt;

    const ft = fieldTotals[a.fieldId] ?? { byPool: {}, totalPkr: 0, perAcrePkr: 0 };
    ft.byPool[pool] = (ft.byPool[pool] ?? 0) + amt;
    ft.totalPkr += amt;
    fieldTotals[a.fieldId] = ft;

    poolTotals[pool] = (poolTotals[pool] ?? 0) + amt;
    grand += amt;
  }

  for (const f of fieldRows) {
    const ft = fieldTotals[f.id];
    if (ft && Number(f.acres) > 0) {
      ft.perAcrePkr = Number((ft.totalPkr / Number(f.acres)).toFixed(2));
    }
  }

  const rows = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    fromDate,
    toDate,
    fields: fieldRows.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      acres: Number(f.acres),
    })),
    rows,
    fieldTotals,
    poolTotals,
    grandTotalPkr: Number(grand.toFixed(2)),
  };
}

/**
 * Drill-down list for one (date, field, optionalPool) cell. Returns the
 * raw cost_allocations rows so the modal can deep-link to source records.
 */
export async function loadCellSourceRecords({
  entityId,
  fieldId,
  onDate,
  pool,
}: {
  entityId: string;
  fieldId: string;
  onDate: string;
  pool?: CostPool;
}): Promise<LedgerSourceRecord[]> {
  const conds = [
    eq(costAllocations.entityId, entityId),
    eq(costAllocations.fieldId, fieldId),
    eq(costAllocations.allocatedOn, onDate),
  ];
  if (pool) conds.push(eq(costAllocations.costPool, pool));

  const rows = await db
    .select({
      id: costAllocations.id,
      sourceModule: costAllocations.sourceModule,
      sourceRecordId: costAllocations.sourceRecordId,
      costPool: costAllocations.costPool,
      amountPkr: costAllocations.amountPkr,
      notes: costAllocations.notes,
      allocatedOn: costAllocations.allocatedOn,
    })
    .from(costAllocations)
    .where(and(...conds));

  return rows.map((r) => ({
    id: r.id,
    sourceModule: r.sourceModule,
    sourceRecordId: r.sourceRecordId,
    costPool: r.costPool as CostPool,
    amountPkr: Number(r.amountPkr),
    notes: r.notes,
    allocatedOn:
      r.allocatedOn instanceof Date
        ? r.allocatedOn.toISOString().slice(0, 10)
        : String(r.allocatedOn),
  }));
}
