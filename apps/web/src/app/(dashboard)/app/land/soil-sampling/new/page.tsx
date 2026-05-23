import { db, fields, blocks, farms } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { SamplingForm } from '@/modules/soil-health/sampling-form';

export const dynamic = 'force-dynamic';

function bboxFromGeometry(g: unknown): [number, number, number, number] | null {
  if (!g || typeof g !== 'object') return null;
  const geom = g as { type?: string; coordinates?: unknown };
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return null;
  const rings: number[][][] =
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])
      : (geom.coordinates as number[][][][]).flat();
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

export default async function NewSamplingEventPage({ searchParams }: { searchParams: Promise<{ fieldId?: string }> }) {
  const sp = await searchParams;
  const rows = await db
    .select({
      id: fields.id,
      code: fields.code,
      name: fields.name,
      geometry: fields.geometry,
    })
    .from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId))
    .limit(500);

  const options = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    bbox: bboxFromGeometry(r.geometry),
  }));

  return (
    <div className="space-y-2">
      <Masthead section="LAND / SOIL SAMPLING / NEW" />
      <SectionDivider />
      <h1 className="text-2xl font-semibold">Plan sampling event</h1>
      <SamplingForm fieldOptions={options} initialFieldId={sp.fieldId} />
    </div>
  );
}
