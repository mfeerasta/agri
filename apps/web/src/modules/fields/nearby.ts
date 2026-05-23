'use server';
import { and, eq } from 'drizzle-orm';
import { db, fields, nearbyFeaturesCache } from '@zameen/db';
import { fetchNearbyFeatures, type NearbyFeature, type NearbyKind } from '@zameen/shared';
import { polygonCentroid } from '@/lib/turf';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_KINDS: NearbyKind[] = ['mandi', 'canal', 'road', 'tubewell', 'mosque', 'hospital'];

export async function getNearbyForField(fieldId: string): Promise<NearbyFeature[]> {
  const cached = await db
    .select()
    .from(nearbyFeaturesCache)
    .where(and(eq(nearbyFeaturesCache.originKind, 'field'), eq(nearbyFeaturesCache.originId, fieldId)))
    .limit(1);
  const hit = cached[0];
  if (hit && Date.now() - new Date(hit.fetchedAt).getTime() < THIRTY_DAYS_MS) {
    return hit.features as NearbyFeature[];
  }

  const [field] = await db.select().from(fields).where(eq(fields.id, fieldId)).limit(1);
  if (!field) return [];
  const centroid = polygonCentroid(field.geometry as never);
  if (!centroid) return [];

  let features: NearbyFeature[] = [];
  try {
    features = await fetchNearbyFeatures({
      lat: centroid.lat,
      lng: centroid.lng,
      radiusKm: 10,
      kinds: DEFAULT_KINDS,
    });
  } catch {
    return hit ? (hit.features as NearbyFeature[]) : [];
  }

  if (hit) {
    await db
      .update(nearbyFeaturesCache)
      .set({ features, fetchedAt: new Date() })
      .where(eq(nearbyFeaturesCache.id, hit.id));
  } else {
    await db.insert(nearbyFeaturesCache).values({
      originKind: 'field',
      originId: fieldId,
      features,
    });
  }
  return features;
}
