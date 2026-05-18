import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, assets, repairRequests, repairWorkOrders, partsReplaced, dieselDailyLogs, assetHourMeters } from '@zameen/db';
import { eq, desc, sql, gte } from 'drizzle-orm';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartCard,
  EmptyState,
  Masthead,
  Pkr,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset) notFound();

  const repairs = await db
    .select({
      id: repairRequests.id,
      requestNumber: repairRequests.requestNumber,
      severity: repairRequests.severity,
      reportedAt: repairRequests.reportedAt,
      finalInvoicePkr: repairWorkOrders.finalInvoicePkr,
    })
    .from(repairRequests)
    .leftJoin(repairWorkOrders, eq(repairWorkOrders.repairRequestId, repairRequests.id))
    .where(eq(repairRequests.assetId, id))
    .orderBy(desc(repairRequests.reportedAt));

  const totalRepair = repairs.reduce((s, r) => s + Number(r.finalInvoicePkr ?? 0), 0);

  const parts = await db
    .select({
      partName: partsReplaced.partName,
      qty: sql<string>`SUM(${partsReplaced.quantity})`,
    })
    .from(partsReplaced)
    .where(eq(partsReplaced.assetId, id))
    .groupBy(partsReplaced.partName);

  const since = new Date(Date.now() - 180 * 86_400_000);
  const fuelHistory = await db
    .select({
      logDate: dieselDailyLogs.logDate,
      hours: dieselDailyLogs.hoursRun,
      litres: dieselDailyLogs.dieselFilledLiters,
    })
    .from(dieselDailyLogs)
    .where(eq(dieselDailyLogs.assetId, id))
    .orderBy(dieselDailyLogs.logDate);

  const fuelSeries = fuelHistory
    .filter((f) => new Date(f.logDate) >= since)
    .map((f) => ({
      day: f.logDate,
      lph: Number(f.hours) > 0 ? Number(f.litres) / Number(f.hours) : 0,
    }));

  const meterHistory = await db
    .select()
    .from(assetHourMeters)
    .where(eq(assetHourMeters.assetId, id))
    .orderBy(desc(assetHourMeters.recordedOn))
    .limit(10);

  return (
    <div className="space-y-2">
      <Masthead section={`ASSET / ${asset.code}`} />
      <SectionDivider />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{asset.code} · {asset.make ?? ''} {asset.model ?? ''}</h1>
          <p className="text-sm text-slate-500">{asset.category} · {asset.year ?? ''}</p>
        </div>
        <Link href={`/inventory/assets/${id}/hour-meter/new` as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
          Record hour meter
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Hour meter" value={Number(asset.currentHourMeter).toFixed(0)} />
        <StatBlock label="Mfr L/hr" value={asset.manufacturerFuelSpecLph ?? '—'} />
        <StatBlock label="Rolling 30d L/hr" value={asset.rolling30dAvgLph ?? '—'} />
        <StatBlock label="Total repair cost" value={<Pkr value={totalRepair} mode="lac_crore" />} />
      </div>

      <SectionDivider label="Fuel consumption (180 days)" />
      {fuelSeries.length > 0 ? (
        <ChartCard title="L/hr trend" data={fuelSeries} xKey="day" yKey="lph" unit="L / hr" />
      ) : (
        <Card><CardContent><EmptyState title="No diesel logs yet" /></CardContent></Card>
      )}

      <SectionDivider label="Repair history" />
      <Card>
        <CardContent className="p-0">
          {repairs.length === 0 ? (
            <EmptyState title="No repairs recorded" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">RR #</th><th className="p-3">Reported</th><th className="p-3">Severity</th><th className="p-3">Final invoice</th></tr>
              </thead>
              <tbody>
                {repairs.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--rule)]">
                    <td className="p-3"><Link href={`/repairs/${r.id}` as never} className="font-semibold">{r.requestNumber}</Link></td>
                    <td className="p-3">{fmtDate(r.reportedAt)}</td>
                    <td className="p-3">{r.severity}</td>
                    <td className="p-3 tabular">{r.finalInvoicePkr ? <Pkr value={Number(r.finalInvoicePkr)} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Parts replaced" />
      <Card>
        <CardContent className="p-0">
          {parts.length === 0 ? (
            <EmptyState title="No parts replaced" />
          ) : (
            <ul>
              {parts.map((p) => (
                <li key={p.partName} className="flex justify-between border-b border-[var(--rule)] px-5 py-3 text-sm">
                  <span>{p.partName}</span>
                  <span className="tabular text-slate-500">{Number(p.qty).toFixed(0)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Hour meter history" />
      <Card>
        <CardContent className="p-0">
          {meterHistory.length === 0 ? (
            <EmptyState title="No readings" />
          ) : (
            <ul>
              {meterHistory.map((m) => (
                <li key={m.id} className="flex justify-between border-b border-[var(--rule)] px-5 py-3 text-sm">
                  <span>{fmtDate(m.recordedOn)} · {m.source}</span>
                  <span className="tabular">{Number(m.meterReading).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
