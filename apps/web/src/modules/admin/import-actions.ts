'use server';
import Papa from 'papaparse';
import { revalidatePath } from 'next/cache';
import {
  db,
  vendors,
  buyers,
  workers,
  inputs,
  fields,
  blocks,
  dieselPurchases,
} from '@zameen/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { ImportTargetKey } from './import-targets';
import { IMPORT_TARGETS } from './import-targets';
import { getSessionContext } from '@/lib/session';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

export interface ValidationResult {
  valid: Record<string, unknown>[];
  invalid: { row: Record<string, string>; errors: string[]; rowIndex: number }[];
}

export interface CommitResult {
  inserted: number;
  skipped: number;
  error?: string;
}

export async function parseCsv(_target: ImportTargetKey, fileContent: string): Promise<ParseResult> {
  if (fileContent.length > MAX_CSV_BYTES) {
    return { headers: [], rows: [], errors: ['CSV exceeds 5 MB limit'] };
  }
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });
  const errors = parsed.errors.map((e) => `Row ${e.row}: ${e.message}`);
  return {
    headers: (parsed.meta.fields ?? []) as string[],
    rows: parsed.data as Record<string, string>[],
    errors,
  };
}

function normalizeNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [fieldKey, sourceHeader] of Object.entries(mapping)) {
      if (!sourceHeader) continue;
      out[fieldKey] = (row[sourceHeader] ?? '').toString().trim();
    }
    return out;
  });
}

export async function validateRows(
  target: ImportTargetKey,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Promise<ValidationResult> {
  const spec = IMPORT_TARGETS[target];
  const mapped = applyMapping(rows, mapping);
  const valid: Record<string, unknown>[] = [];
  const invalid: ValidationResult['invalid'] = [];

  const ctx = await getSessionContext();
  if (!ctx) {
    return { valid: [], invalid: rows.map((r, i) => ({ row: r, errors: ['Not authenticated'], rowIndex: i })) };
  }

  // Preload existing codes for uniqueness checks.
  const seenCodes = new Set<string>();
  let existingCodes = new Set<string>();
  if (target === 'vendors') {
    const ex = await db.select({ code: vendors.code }).from(vendors).where(eq(vendors.entityId, ctx.entityId));
    existingCodes = new Set(ex.map((e) => e.code));
  } else if (target === 'buyers') {
    const ex = await db.select({ code: buyers.code }).from(buyers).where(eq(buyers.entityId, ctx.entityId));
    existingCodes = new Set(ex.map((e) => e.code));
  } else if (target === 'workers') {
    const ex = await db.select({ code: workers.code }).from(workers).where(eq(workers.entityId, ctx.entityId));
    existingCodes = new Set(ex.map((e) => e.code));
  } else if (target === 'fields') {
    const ex = await db.select({ code: fields.code }).from(fields);
    existingCodes = new Set(ex.map((e) => e.code));
  }

  mapped.forEach((row, idx) => {
    const errors: string[] = [];
    for (const f of spec.fields) {
      if (f.required && !row[f.key]) errors.push(`Missing ${f.label}`);
    }

    if (target === 'fields') {
      if (row.acres && normalizeNumber(row.acres) === null) errors.push('Acres must be a number');
      if (row.geometry) {
        try {
          JSON.parse(row.geometry);
        } catch {
          errors.push('Geometry must be valid GeoJSON');
        }
      }
      if (row.code && (seenCodes.has(row.code) || existingCodes.has(row.code))) {
        errors.push(`Field code "${row.code}" already exists`);
      }
      if (row.code) seenCodes.add(row.code);
    }

    if (target === 'workers') {
      if (row.dailyWage && normalizeNumber(row.dailyWage) === null) errors.push('Daily wage invalid');
      if (row.monthlySalary && normalizeNumber(row.monthlySalary) === null) errors.push('Monthly salary invalid');
      if (!row.dailyWage && !row.monthlySalary) errors.push('Provide daily wage or monthly salary');
      const wt = row.workerType;
      if (wt && !['permanent', 'seasonal', 'daily_wage', 'contract', 'piece_rate'].includes(wt)) {
        errors.push(`Worker type "${wt}" invalid`);
      }
      if (row.code && (seenCodes.has(row.code) || existingCodes.has(row.code))) {
        errors.push(`Worker code "${row.code}" already exists`);
      }
      if (row.code) seenCodes.add(row.code);
    }

    if (target === 'vendors' || target === 'buyers') {
      if (row.code && (seenCodes.has(row.code) || existingCodes.has(row.code))) {
        errors.push(`Code "${row.code}" already exists`);
      }
      if (row.code) seenCodes.add(row.code);
    }

    if (target === 'inputs') {
      const t = row.type;
      if (t && !['seed', 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'fuel', 'packaging', 'other'].includes(t)) {
        errors.push(`Type "${t}" invalid`);
      }
    }

    if (target === 'diesel-purchases') {
      if (row.quantityLiters && normalizeNumber(row.quantityLiters) === null) errors.push('Quantity invalid');
      if (row.totalPkr && normalizeNumber(row.totalPkr) === null) errors.push('Total invalid');
    }

    if (errors.length > 0) {
      invalid.push({ row, errors, rowIndex: idx });
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid };
}

export async function commitImport(
  target: ImportTargetKey,
  validRows: Record<string, unknown>[],
): Promise<CommitResult> {
  const ctx = await getSessionContext();
  if (!ctx) return { inserted: 0, skipped: validRows.length, error: 'Not authenticated' };
  if (validRows.length === 0) return { inserted: 0, skipped: 0 };

  try {
    if (target === 'vendors') {
      const values = validRows.map((r) => ({
        entityId: ctx.entityId,
        code: String(r.code),
        name: String(r.name),
        nameUr: r.nameUr ? String(r.nameUr) : null,
        category: r.category ? String(r.category) : null,
        phone: r.phone ? String(r.phone) : null,
        ntn: r.ntn ? String(r.ntn) : null,
        creditTermsDays: (normalizeNumber(r.creditTermsDays) ?? 0).toString(),
      }));
      await db.insert(vendors).values(values);
    } else if (target === 'buyers') {
      const values = validRows.map((r) => ({
        entityId: ctx.entityId,
        code: String(r.code),
        name: String(r.name),
        category: String(r.category),
        phone: r.phone ? String(r.phone) : null,
        address: r.address ? String(r.address) : null,
      }));
      await db.insert(buyers).values(values);
    } else if (target === 'workers') {
      const values = validRows.map((r) => ({
        entityId: ctx.entityId,
        code: String(r.code),
        fullName: String(r.fullName),
        fullNameUr: r.fullNameUr ? String(r.fullNameUr) : null,
        phone: r.phone ? String(r.phone) : null,
        cnicLast4: r.cnicLast4 ? String(r.cnicLast4) : null,
        workerType: String(r.workerType) as 'permanent' | 'seasonal' | 'daily_wage' | 'contract' | 'piece_rate',
        dailyWagePkr: r.dailyWage ? (normalizeNumber(r.dailyWage) ?? 0).toFixed(2) : null,
        monthlySalaryPkr: r.monthlySalary ? (normalizeNumber(r.monthlySalary) ?? 0).toFixed(2) : null,
        hireDate: String(r.hireDate),
      }));
      await db.insert(workers).values(values);
    } else if (target === 'inputs') {
      const values = validRows.map((r) => ({
        entityId: ctx.entityId,
        type: String(r.type) as 'seed' | 'fertilizer' | 'pesticide' | 'herbicide' | 'fungicide' | 'fuel' | 'packaging' | 'other',
        name: String(r.name),
        nameUr: r.nameUr ? String(r.nameUr) : null,
        brand: r.brand ? String(r.brand) : null,
        unit: String(r.unit),
        unitSizeKg: r.unitSizeKg ? (normalizeNumber(r.unitSizeKg) ?? 0).toString() : null,
      }));
      await db.insert(inputs).values(values);
    } else if (target === 'fields') {
      const codes = Array.from(new Set(validRows.map((r) => String(r.blockCode))));
      const blockRows = codes.length
        ? await db.select().from(blocks).where(inArray(blocks.code, codes))
        : [];
      const blockByCode = new Map(blockRows.map((b) => [b.code, b.id]));
      const skipped: number[] = [];
      const toInsert = validRows.flatMap((r, i) => {
        const blockId = blockByCode.get(String(r.blockCode));
        if (!blockId) {
          skipped.push(i);
          return [];
        }
        return [{
          blockId,
          code: String(r.code),
          name: r.name ? String(r.name) : null,
          nameUr: r.nameUr ? String(r.nameUr) : null,
          acres: (normalizeNumber(r.acres) ?? 0).toString(),
          geometry: JSON.parse(String(r.geometry)),
          khasraNumbers: r.khasra ? String(r.khasra).split(',').map((s) => s.trim()) : [],
          tenure: (r.tenure ? String(r.tenure) : 'owned') as 'owned' | 'leased_in' | 'leased_out' | 'sharecropped',
        }];
      });
      if (toInsert.length > 0) await db.insert(fields).values(toInsert);
      revalidatePath('/admin/import');
      return { inserted: toInsert.length, skipped: skipped.length };
    } else if (target === 'diesel-purchases') {
      const values = validRows.map((r) => ({
        entityId: ctx.entityId,
        purchasedAt: new Date(String(r.purchasedAt)),
        vendorName: String(r.vendor),
        quantityLiters: (normalizeNumber(r.quantityLiters) ?? 0).toString(),
        rateLiterPkr: (normalizeNumber(r.rateLiterPkr) ?? 0).toFixed(2),
        totalPkr: (normalizeNumber(r.totalPkr) ?? 0).toFixed(2),
        paymentMethod: 'cash' as const,
      }));
      await db.insert(dieselPurchases).values(values);
    }

    revalidatePath('/admin/import');
    return { inserted: validRows.length, skipped: 0 };
  } catch (e) {
    return { inserted: 0, skipped: validRows.length, error: (e as Error).message };
  }
}

// Helper exposed for the client uniqueness pre-check.
export async function getExistingCodes(target: ImportTargetKey): Promise<string[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  if (target === 'vendors') {
    const ex = await db.select({ code: vendors.code }).from(vendors).where(eq(vendors.entityId, ctx.entityId));
    return ex.map((e) => e.code);
  }
  if (target === 'buyers') {
    const ex = await db.select({ code: buyers.code }).from(buyers).where(eq(buyers.entityId, ctx.entityId));
    return ex.map((e) => e.code);
  }
  if (target === 'workers') {
    const ex = await db.select({ code: workers.code }).from(workers).where(and(eq(workers.entityId, ctx.entityId)));
    return ex.map((e) => e.code);
  }
  return [];
}
