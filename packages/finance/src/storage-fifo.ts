import { and, eq } from 'drizzle-orm';
import { db, produceLots, storageLocations, fields } from '@zameen/db';

export type AgeBucket = '0-30d' | '31-60d' | '61-90d' | '90-180d' | '180d+';
export type QualityAlert = 'none' | 'moisture' | 'pest' | 'aging';

export interface ProduceLotStatus {
  lotId: string;
  lotNumber: string;
  cropName: string;
  fieldCode: string;
  storageLocationId: string | null;
  storageLocationCode: string;
  netWeightKg: number;
  daysInStorage: number;
  ageBucket: AgeBucket;
  fifoRank: number;
  shrinkagePct: number;
  estimatedShrinkagePctNow: number;
  qualityAlert: QualityAlert;
}

function bucketFor(days: number): AgeBucket {
  if (days <= 30) return '0-30d';
  if (days <= 60) return '31-60d';
  if (days <= 90) return '61-90d';
  if (days <= 180) return '90-180d';
  return '180d+';
}

/**
 * Compute per-lot FIFO + ageing state for an entity.
 *
 * FIFO rank is per storage location, ascending by received_on (1 = oldest in that location).
 * Estimated shrinkage is a heuristic 0.02% per day in storage. Quality alert is derived from
 * recorded moisture pct (>14 = 'moisture') or age >= 90d ('aging'); 'pest' is reserved for
 * upstream diagnostics tagging via the lots.status field (status = 'pest_flag').
 */
export async function getProduceLotsStatus(entityId: string): Promise<ProduceLotStatus[]> {
  const rows = await db
    .select({
      lotId: produceLots.id,
      lotNumber: produceLots.lotNumber,
      cropName: produceLots.cropName,
      moisturePct: produceLots.moisturePct,
      netWeightKg: produceLots.netWeightKg,
      receivedOn: produceLots.receivedOn,
      shrinkagePct: produceLots.shrinkagePct,
      status: produceLots.status,
      storageLocationId: produceLots.storageLocationId,
      storageLocationCode: storageLocations.code,
      fieldCode: fields.code,
    })
    .from(produceLots)
    .leftJoin(storageLocations, eq(storageLocations.id, produceLots.storageLocationId))
    .leftJoin(fields, eq(fields.id, produceLots.fieldId))
    .where(and(eq(produceLots.entityId, entityId), eq(produceLots.status, 'on_hand')));

  const now = Date.now();
  const enriched = rows.map((r) => {
    const received = r.receivedOn instanceof Date ? r.receivedOn.getTime() : new Date(r.receivedOn as unknown as string).getTime();
    const days = Math.max(0, Math.floor((now - received) / 86_400_000));
    const moisture = r.moisturePct ? Number(r.moisturePct) : null;
    let qualityAlert: QualityAlert = 'none';
    if (moisture !== null && moisture > 14) qualityAlert = 'moisture';
    else if (r.status === 'pest_flag') qualityAlert = 'pest';
    else if (days >= 90) qualityAlert = 'aging';
    return {
      lotId: r.lotId,
      lotNumber: r.lotNumber,
      cropName: r.cropName,
      fieldCode: r.fieldCode ?? '',
      storageLocationId: r.storageLocationId ?? null,
      storageLocationCode: r.storageLocationCode ?? 'unassigned',
      netWeightKg: Number(r.netWeightKg),
      daysInStorage: days,
      ageBucket: bucketFor(days),
      fifoRank: 0,
      shrinkagePct: Number(r.shrinkagePct ?? 0),
      estimatedShrinkagePctNow: Number((days * 0.02).toFixed(2)),
      qualityAlert,
      receivedOnMs: received,
    };
  });

  const grouped = new Map<string, typeof enriched>();
  for (const lot of enriched) {
    const key = lot.storageLocationId ?? '__unassigned__';
    const arr = grouped.get(key) ?? [];
    arr.push(lot);
    grouped.set(key, arr);
  }
  for (const arr of grouped.values()) {
    arr.sort((a, b) => a.receivedOnMs - b.receivedOnMs);
    arr.forEach((lot, idx) => {
      lot.fifoRank = idx + 1;
    });
  }

  return enriched.map(({ receivedOnMs: _drop, ...rest }) => rest);
}

export function ageBucketColor(b: AgeBucket): string {
  switch (b) {
    case '0-30d': return 'bg-emerald-500';
    case '31-60d': return 'bg-lime-500';
    case '61-90d': return 'bg-yellow-500';
    case '90-180d': return 'bg-orange-500';
    case '180d+': return 'bg-red-600';
  }
}

export interface AgeingByBucket {
  bucket: AgeBucket;
  weightKg: number;
  lotCount: number;
}

export async function getProduceAgeingSummary(entityId: string): Promise<AgeingByBucket[]> {
  const lots = await getProduceLotsStatus(entityId);
  const buckets: AgeBucket[] = ['0-30d', '31-60d', '61-90d', '90-180d', '180d+'];
  return buckets.map((b) => {
    const inBucket = lots.filter((l) => l.ageBucket === b);
    return {
      bucket: b,
      weightKg: inBucket.reduce((s, l) => s + l.netWeightKg, 0),
      lotCount: inBucket.length,
    };
  });
}

export function topMoveOutCandidates(lots: ProduceLotStatus[], n = 3): ProduceLotStatus[] {
  return [...lots]
    .filter((l) => l.fifoRank === 1 && l.daysInStorage >= 30)
    .sort((a, b) => b.daysInStorage - a.daysInStorage)
    .slice(0, n);
}
