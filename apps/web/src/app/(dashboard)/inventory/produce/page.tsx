import Link from 'next/link';
import { db, produceLots, storageLocations } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ProduceListPage() {
  const rows = await db
    .select({
      id: produceLots.id,
      lotNumber: produceLots.lotNumber,
      cropName: produceLots.cropName,
      grade: produceLots.grade,
      moisturePct: produceLots.moisturePct,
      netWeightKg: produceLots.netWeightKg,
      status: produceLots.status,
      receivedOn: produceLots.receivedOn,
      locName: storageLocations.name,
    })
    .from(produceLots)
    .leftJoin(storageLocations, eq(storageLocations.id, produceLots.storageLocationId))
    .orderBy(desc(produceLots.receivedOn));

  return (
    <div className="space-y-2">
      <Masthead section="PRODUCE" />
      <SectionDivider />
      <div className="flex justify-end gap-2">
        <Link href={'/inventory/produce/movements/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">Move lot</Link>
        <Link href={'/inventory/produce/storage-locations' as never} className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white">Locations</Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="No produce lots yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Lot #</th><th className="p-3">Crop</th><th className="p-3">Grade</th>
                  <th className="p-3">Moisture %</th><th className="p-3">Weight (kg)</th><th className="p-3">Location</th>
                  <th className="p-3">Status</th><th className="p-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--rule)]">
                    <td className="p-3"><Link href={`/inventory/produce/lots/${r.id}` as never} className="font-semibold">{r.lotNumber}</Link></td>
                    <td className="p-3">{r.cropName}</td>
                    <td className="p-3 uppercase">{r.grade}</td>
                    <td className="p-3 tabular">{r.moisturePct ?? ''}</td>
                    <td className="p-3 tabular">{Number(r.netWeightKg).toFixed(2)}</td>
                    <td className="p-3">{r.locName ?? ''}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">{fmtDate(r.receivedOn)}</td>
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
