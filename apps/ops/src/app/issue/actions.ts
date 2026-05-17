'use server';
import { revalidatePath } from 'next/cache';
import { db, inputIssuances, inputs as inputsTable } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { allocateCost } from '@zameen/finance';
import type { CostPool } from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

interface Payload {
  entityId: string;
  inputId: string;
  fieldId: string;
  quantity: number;
  unitCostPkr: number;
  totalCostPkr: number;
  receivedBy: string;
  purpose?: string;
}

type Result = { ok: true; id: string } | { ok: false; error: string };

const INPUT_TYPE_TO_POOL: Record<string, CostPool> = {
  seed: 'seed',
  fertilizer: 'fertilizer',
  pesticide: 'pesticide',
  herbicide: 'pesticide',
  fungicide: 'pesticide',
  fuel: 'diesel',
  packaging: 'freight',
  other: 'freight',
};

export async function submitIssuance(p: Payload): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [input] = await db.select().from(inputsTable).where(eq(inputsTable.id, p.inputId)).limit(1);
  if (!input) return { ok: false, error: 'Unknown input' };

  const [row] = await db
    .insert(inputIssuances)
    .values({
      inputId: p.inputId,
      fieldId: p.fieldId,
      issuedOn: new Date(),
      quantity: p.quantity.toString(),
      unitCostPkr: p.unitCostPkr.toString(),
      totalCostPkr: p.totalCostPkr.toString(),
      issuedTo: ctx.userId,
      receivedBy: p.receivedBy,
      purpose: p.purpose ?? null,
    })
    .returning();

  const pool: CostPool = INPUT_TYPE_TO_POOL[input.type] ?? 'fertilizer';
  await allocateCost({
    entityId: p.entityId,
    sourceModule: 'input',
    sourceRecordId: row!.id,
    fieldId: p.fieldId,
    costPool: pool,
    amountPkr: p.totalCostPkr,
    allocatedOn: new Date().toISOString().slice(0, 10),
    allocationKey: 'direct',
  });

  revalidatePath('/issue');
  return { ok: true, id: row!.id };
}
