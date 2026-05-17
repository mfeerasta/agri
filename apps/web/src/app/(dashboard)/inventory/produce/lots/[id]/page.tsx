import { notFound } from 'next/navigation';
import { db, produceLots, produceMovements, storageLocations, cropPlans, fields, harvestRecords } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lot] = await db.select().from(produceLots).where(eq(produceLots.id, id)).limit(1);
  if (!lot) notFound();

  const [plan] = lot.cropPlanId
    ? await db.select({ id: cropPlans.id, season: cropPlans.seasonLabel, fieldCode: fields.code }).from(cropPlans).leftJoin(fields, eq(fields.id, cropPlans.fieldId)).where(eq(cropPlans.id, lot.cropPlanId)).limit(1)
    : [undefined];

  const [harvest] = lot.harvestRecordId
    ? await db.select().from(harvestRecords).where(eq(harvestRecords.id, lot.harvestRecordId)).limit(1)
    : [undefined];

  const movements = await db
    .select({
      id: produceMovements.id,
      movedOn: produceMovements.movedOn,
      qty: produceMovements.quantityKg,
      reason: produceMovements.reason,
      fromName: storageLocations.name,
    })
    .from(produceMovements)
    .leftJoin(storageLocations, eq(storageLocations.id, produceMovements.fromLocationId))
    .where(eq(produceMovements.produceLotId, id))
    .orderBy(desc(produceMovements.movedOn));

  return (
    <div className="space-y-2">
      <Masthead section={`PRODUCE / ${lot.lotNumber}`} />
      <SectionDivider />
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Crop" value={lot.cropName} />
        <StatBlock label="Grade" value={lot.grade.toUpperCase()} />
        <StatBlock label="Net weight" value={`${Number(lot.netWeightKg).toFixed(2)} kg`} />
        <StatBlock label="Status" value={lot.status} />
      </div>

      <SectionDivider label="Provenance" />
      <Card>
        <CardContent className="space-y-2 text-sm">
          <div>Field: {plan?.fieldCode ?? '—'}</div>
          <div>Crop plan: {plan?.season ?? '—'}</div>
          <div>Harvest: {harvest ? `${fmtDate(harvest.harvestedOn)} · ${Number(harvest.grossYieldKg).toFixed(0)} kg` : '—'}</div>
        </CardContent>
      </Card>

      <SectionDivider label="Movements (FIFO)" />
      <Card>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <EmptyState title="No movements yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Moved on</th><th className="p-3">From</th><th className="p-3">Qty (kg)</th><th className="p-3">Reason</th></tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">{fmtDate(m.movedOn)}</td>
                    <td className="p-3">{m.fromName ?? 'field'}</td>
                    <td className="p-3 tabular">{Number(m.qty).toFixed(2)}</td>
                    <td className="p-3">{m.reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
