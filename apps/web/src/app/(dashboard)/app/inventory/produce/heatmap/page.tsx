import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { getProduceLotsStatus, topMoveOutCandidates, ageBucketColor, type ProduceLotStatus } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

const BUCKET_LABELS = ['0-30d', '31-60d', '61-90d', '90-180d', '180d+'] as const;

export default async function ProduceHeatmapPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <EmptyState title="Sign in to view storage heat-map" />;
  const lots = await getProduceLotsStatus(ctx.entityId);

  const byLocation = new Map<string, ProduceLotStatus[]>();
  for (const lot of lots) {
    const arr = byLocation.get(lot.storageLocationCode) ?? [];
    arr.push(lot);
    byLocation.set(lot.storageLocationCode, arr);
  }
  const topMoves = topMoveOutCandidates(lots, 3);

  return (
    <div className="space-y-3">
      <Masthead section="STORAGE HEAT-MAP" />
      <SectionDivider />

      <Card>
        <CardHeader><CardTitle>Legend</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap text-xs">
          {BUCKET_LABELS.map((b) => (
            <div key={b} className="flex items-center gap-2">
              <span className={`inline-block w-4 h-4 rounded ${ageBucketColor(b)}`} />
              <span>{b}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {topMoves.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Move oldest first</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {topMoves.map((l) => (
              <div key={l.lotId} className="flex items-center justify-between">
                <div>
                  <Link href={`/inventory/produce/lots/${l.lotId}` as never} className="font-semibold">{l.lotNumber}</Link>
                  <span className="text-[var(--fg-muted)] ml-2">{l.cropName} · {l.storageLocationCode} · {l.daysInStorage}d</span>
                </div>
                <span className="smallcaps text-[0.65rem]">{l.ageBucket} · est. {l.estimatedShrinkagePctNow}% shrink</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {byLocation.size === 0 ? (
        <EmptyState title="No on-hand produce lots" />
      ) : (
        [...byLocation.entries()].map(([code, lotsHere]) => {
          const sorted = [...lotsHere].sort((a, b) => a.fifoRank - b.fifoRank);
          const totalKg = sorted.reduce((s, l) => s + l.netWeightKg, 0);
          return (
            <Card key={code}>
              <CardHeader>
                <CardTitle>{code} <span className="text-[var(--fg-muted)] text-xs font-normal">· {sorted.length} lots · {totalKg.toFixed(0)} kg</span></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 flex-wrap">
                  {sorted.map((l) => (
                    <Link
                      key={l.lotId}
                      href={`/inventory/produce/lots/${l.lotId}` as never}
                      title={`${l.lotNumber} · ${l.cropName} · ${l.netWeightKg.toFixed(0)}kg · ${l.daysInStorage}d in storage · FIFO #${l.fifoRank} · ${l.qualityAlert !== 'none' ? l.qualityAlert : 'no alerts'}`}
                      className={`${ageBucketColor(l.ageBucket)} text-white text-[10px] px-2 py-1 rounded hover:opacity-80 tabular`}
                    >
                      {l.fifoRank}·{l.lotNumber}
                      {l.qualityAlert !== 'none' && <span className="ml-1">!</span>}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
