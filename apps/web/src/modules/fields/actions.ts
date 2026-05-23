'use server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { fieldCreateSchema, fieldUpdateSchema, soilTestCreateSchema } from '@zameen/shared/validators';
import { fetchSoilGrids, classifyTexture } from '@zameen/shared';
import { db, fields, soilTests } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { isValidPolygon, polygonAreaAcres, polygonCentroid } from '@/lib/turf';

type Result = { ok: true; id: string; warning?: string } | { ok: false; error: string };

const AREA_TOLERANCE = 0.05; // 5%

function areaCheck(geometry: unknown, clientAcres: number): string | null {
  if (!isValidPolygon(geometry)) return null;
  const serverAcres = polygonAreaAcres(geometry);
  if (serverAcres <= 0) return null;
  const drift = Math.abs(serverAcres - clientAcres) / serverAcres;
  if (drift > AREA_TOLERANCE) {
    return `Submitted acres (${clientAcres.toFixed(3)}) differs from polygon-derived area (${serverAcres.toFixed(3)}) by ${(drift * 100).toFixed(1)}%.`;
  }
  return null;
}

export async function createField(raw: unknown): Promise<Result> {
  const parsed = fieldCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const d = parsed.data;
  if (!isValidPolygon(d.geometry)) {
    return { ok: false, error: 'Geometry must be a valid GeoJSON Polygon or MultiPolygon with closed rings.' };
  }
  const warning = areaCheck(d.geometry, d.acres);
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
  // Best-effort: fetch SoilGrids baseline at the polygon centroid so the
  // field dashboard shows a soil profile before any lab test runs. We never
  // let this block field creation.
  try {
    const centroid = polygonCentroid(d.geometry);
    if (centroid) {
      const soil = await fetchSoilGrids({ lat: centroid.lat, lng: centroid.lng });
      await db
        .update(fields)
        .set({ soilGridsData: soil, soilGridsFetchedAt: new Date() })
        .where(eq(fields.id, row!.id));

      const existing = await db
        .select({ id: soilTests.id })
        .from(soilTests)
        .where(eq(soilTests.fieldId, row!.id))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(soilTests).values({
          fieldId: row!.id,
          testedOn: new Date(soil.fetchedAt),
          laboratory: 'SoilGrids 250m raster',
          ph: Number.isFinite(soil.ph['0-5cm']) ? soil.ph['0-5cm'].toFixed(2) : null,
          organicMatterPct: Number.isFinite(soil.organicCarbonGPerKg['0-5cm'])
            ? (soil.organicCarbonGPerKg['0-5cm'] * 0.1724 * 0.1).toFixed(2)
            : null,
          texture: Number.isFinite(soil.sandPct['0-5cm']) && Number.isFinite(soil.clayPct['0-5cm'])
            ? classifyTexture(soil.sandPct['0-5cm'], soil.clayPct['0-5cm'])
            : null,
          fullReport: { source: 'soilgrids', data: soil },
        });
      }
    }
  } catch {
    // SoilGrids is best-effort; ignore failures.
  }

  revalidatePath('/fields');
  revalidatePath('/fields/map');
  return warning ? { ok: true, id: row!.id, warning } : { ok: true, id: row!.id };
}

export async function updateField(raw: unknown): Promise<Result> {
  const parsed = fieldUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const { id, ...d } = parsed.data;
  let warning: string | null = null;
  if (d.geometry !== undefined && !isValidPolygon(d.geometry)) {
    return { ok: false, error: 'Geometry must be a valid GeoJSON Polygon or MultiPolygon with closed rings.' };
  }
  if (d.geometry !== undefined && d.acres !== undefined) {
    warning = areaCheck(d.geometry, d.acres);
  }
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
  revalidatePath('/fields/map');
  return warning ? { ok: true, id, warning } : { ok: true, id };
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
