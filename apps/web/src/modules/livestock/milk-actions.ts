'use server';
import { revalidatePath } from 'next/cache';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { db, animals, livestockHerds, milkProductionLogs } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export type MilkShift = 'morning' | 'evening';

export interface MilkColumn {
  id: string;
  kind: 'animal' | 'herd';
  label: string;
  labelUr: string | null;
  species: string;
}

export interface MilkCell {
  morning: number;
  evening: number;
  fatPct?: number;
  snfPct?: number;
}

export interface MilkRow {
  date: string;
  cells: Record<string, MilkCell>;
  total: number;
}

export interface MilkMatrix {
  fromDate: string;
  toDate: string;
  columns: MilkColumn[];
  rows: MilkRow[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

export async function loadMilkMatrix(args: {
  entityId: string;
  fromDate: string;
  toDate: string;
}): Promise<MilkMatrix> {
  const { entityId, fromDate, toDate } = args;

  const herdRows = await db
    .select({ id: livestockHerds.id, name: livestockHerds.name, nameUr: livestockHerds.nameUr, species: livestockHerds.species })
    .from(livestockHerds)
    .where(eq(livestockHerds.entityId, entityId));

  const animalRows = await db
    .select({ id: animals.id, earTag: animals.earTag, species: animals.species, status: animals.status, sex: animals.sex })
    .from(animals)
    .where(and(eq(animals.entityId, entityId), eq(animals.status, 'active'), eq(animals.sex, 'female')));

  const columns: MilkColumn[] = [
    ...herdRows.map<MilkColumn>((h) => ({
      id: h.id,
      kind: 'herd',
      label: h.name,
      labelUr: h.nameUr,
      species: h.species,
    })),
    ...animalRows.map<MilkColumn>((a) => ({
      id: a.id,
      kind: 'animal',
      label: a.earTag,
      labelUr: null,
      species: a.species,
    })),
  ];

  const animalIds = animalRows.map((a) => a.id);
  const herdIds = herdRows.map((h) => h.id);

  const logsRaw = (animalIds.length || herdIds.length)
    ? await db
        .select({
          animalId: milkProductionLogs.animalId,
          herdId: milkProductionLogs.herdId,
          logDate: milkProductionLogs.logDate,
          shift: milkProductionLogs.shift,
          liters: milkProductionLogs.liters,
          fatPct: milkProductionLogs.fatPct,
          snfPct: milkProductionLogs.snfPct,
        })
        .from(milkProductionLogs)
        .where(
          and(
            between(milkProductionLogs.logDate, fromDate, toDate),
          ),
        )
    : [];

  const byDate = new Map<string, MilkRow>();
  const columnTotals: Record<string, number> = {};
  let grand = 0;

  for (const r of logsRaw) {
    const key = r.animalId ?? r.herdId;
    if (!key) continue;
    // RLS scopes by entity, but defend in app layer too
    const validCol = columns.some((c) => c.id === key);
    if (!validCol) continue;

    const d = typeof r.logDate === 'string' ? r.logDate : new Date(r.logDate as unknown as string).toISOString().slice(0, 10);
    let row = byDate.get(d);
    if (!row) {
      row = { date: d, cells: {}, total: 0 };
      byDate.set(d, row);
    }
    const cell = row.cells[key] ?? { morning: 0, evening: 0 };
    const liters = Number(r.liters);
    if (r.shift === 'morning') cell.morning += liters;
    else cell.evening += liters;
    if (r.fatPct != null) cell.fatPct = Number(r.fatPct);
    if (r.snfPct != null) cell.snfPct = Number(r.snfPct);
    row.cells[key] = cell;
    row.total += liters;
    columnTotals[key] = (columnTotals[key] ?? 0) + liters;
    grand += liters;
  }

  const rows = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  return { fromDate, toDate, columns, rows, columnTotals, grandTotal: grand };
}

export interface LogMilkArgs {
  animalId?: string;
  herdId?: string;
  logDate: string;
  shift: MilkShift;
  liters: number;
  fatPct?: number;
  snfPct?: number;
  notes?: string;
  revalidate?: string;
}

export async function logMilk(args: LogMilkArgs): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  if (!args.animalId && !args.herdId) return { ok: false, error: 'animalId or herdId required' };
  if (!(args.liters > 0)) return { ok: false, error: 'liters must be positive' };

  await db.insert(milkProductionLogs).values({
    animalId: args.animalId,
    herdId: args.herdId,
    logDate: args.logDate,
    shift: args.shift,
    liters: args.liters.toString(),
    fatPct: args.fatPct != null ? args.fatPct.toString() : null,
    snfPct: args.snfPct != null ? args.snfPct.toString() : null,
    notes: args.notes,
    recordedBy: ctx.userId,
  });

  if (args.revalidate) revalidatePath(args.revalidate);
  revalidatePath('/livestock/milk-log');
  return { ok: true };
}

export async function lifetimeMilkLiters(animalId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${milkProductionLogs.liters}), 0)` })
    .from(milkProductionLogs)
    .where(eq(milkProductionLogs.animalId, animalId));
  return Number(row?.total ?? 0);
}
