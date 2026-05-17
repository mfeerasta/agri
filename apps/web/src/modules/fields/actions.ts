'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { fieldCreateSchema, fieldUpdateSchema, soilTestCreateSchema } from '@zameen/shared/validators';
import { db, fields, soilTests } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function createField(raw: unknown): Promise<Result> {
  const parsed = fieldCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(fields)
    .values({
      blockId: d.blockId,
      code: d.code,
      name: d.name ?? null,
      nameUr: d.nameUr ?? null,
      acres: d.acres.toString(),
      geometry: d.geometry,
      khasraNumbers: d.khasraNumbers,
      khatooniNumber: d.khatooniNumber ?? null,
      tenure: d.tenure,
      tenureDetails: d.tenureDetails ?? null,
    })
    .returning();
  revalidatePath('/fields');
  return { ok: true, id: row!.id };
}

export async function updateField(raw: unknown): Promise<Result> {
  const parsed = fieldUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const { id, ...d } = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (d.code !== undefined) patch.code = d.code;
  if (d.name !== undefined) patch.name = d.name;
  if (d.nameUr !== undefined) patch.nameUr = d.nameUr;
  if (d.acres !== undefined) patch.acres = d.acres.toString();
  if (d.geometry !== undefined) patch.geometry = d.geometry;
  if (d.khasraNumbers !== undefined) patch.khasraNumbers = d.khasraNumbers;
  if (d.khatooniNumber !== undefined) patch.khatooniNumber = d.khatooniNumber;
  if (d.tenure !== undefined) patch.tenure = d.tenure;
  if (d.tenureDetails !== undefined) patch.tenureDetails = d.tenureDetails;
  if (d.blockId !== undefined) patch.blockId = d.blockId;
  await db.update(fields).set(patch).where(eq(fields.id, id));
  revalidatePath('/fields');
  revalidatePath(`/fields/${id}`);
  return { ok: true, id };
}

export async function createSoilTest(raw: unknown): Promise<Result> {
  const parsed = soilTestCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  const [row] = await db
    .insert(soilTests)
    .values({
      fieldId: d.fieldId,
      testedOn: new Date(d.testedOn),
      laboratory: d.laboratory ?? null,
      ph: d.ph?.toString() ?? null,
      nitrogenPpm: d.nitrogenPpm?.toString() ?? null,
      phosphorusPpm: d.phosphorusPpm?.toString() ?? null,
      potassiumPpm: d.potassiumPpm?.toString() ?? null,
      organicMatterPct: d.organicMatterPct?.toString() ?? null,
      texture: d.texture ?? null,
      salinityEc: d.salinityEc?.toString() ?? null,
      reportUrl: d.reportPhotoUrls[0] ?? null,
      fullReport: { photoUrls: d.reportPhotoUrls },
    })
    .returning();
  revalidatePath(`/fields/${d.fieldId}`);
  return { ok: true, id: row!.id };
}
