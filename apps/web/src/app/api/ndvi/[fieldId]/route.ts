/**
 * GET /api/ndvi/[fieldId]
 * Returns the latest 30 NDVI observations for a field. Powers the trend chart
 * on the field detail page. RLS on zameen.ndvi_observations enforces entity
 * scope; we additionally gate on a valid session.
 */

import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db, ndviObservations, fields, blocks, farms } from '@zameen/db';
import { getSessionContext } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ fieldId: string }> },
): Promise<NextResponse> {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { fieldId } = await ctx.params;

  // Entity scope check: field must belong to a farm in the user's entity.
  const [scope] = await db
    .select({ entityId: farms.entityId })
    .from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId))
    .where(eq(fields.id, fieldId))
    .limit(1);
  if (!scope) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (session.entityId && scope.entityId !== session.entityId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: ndviObservations.id,
      observedOn: ndviObservations.observedOn,
      meanNdvi: ndviObservations.meanNdvi,
      minNdvi: ndviObservations.minNdvi,
      maxNdvi: ndviObservations.maxNdvi,
      stdNdvi: ndviObservations.stdNdvi,
      cloudCoverPct: ndviObservations.cloudCoverPct,
      pixelsCount: ndviObservations.pixelsCount,
      previewImageUrl: ndviObservations.previewImageUrl,
      satellite: ndviObservations.satellite,
    })
    .from(ndviObservations)
    .where(and(eq(ndviObservations.fieldId, fieldId), eq(ndviObservations.satellite, 'sentinel-2')))
    .orderBy(desc(ndviObservations.observedOn))
    .limit(30);

  return NextResponse.json({ items: rows });
}
