import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, assets, maintenancePlans, maintenanceExecutions } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, Pkr, SectionDivider, StatBlock } from '@zameen/ui';
import { computeLifecycleCost, monthlyCostTrend } from '@zameen/finance';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssetMaintenancePage({ params }: PageProps) {
  const { id } = await params;
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  if (!asset) {
    return <div className="p-6">Asset not found.</div>;
  }

  const summary = await computeLifecycleCost(id);
  const trend = await monthlyCostTrend(id, 12);
  const plans = await db.select().from(maintenancePlans).where(eq(maintenancePlans.assetId, id));
  const history = await db
    .select()
    .from(maintenanceExecutions)
    .where(eq(maintenanceExecutions.assetId, id))
    .orderBy(desc(maintenanceExecutions.executedOn))
    .limit(20);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section={`${asset.code} — Lifecycle`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Total cost" value={<Pkr value={summary.totalCostPkr} />} caption="all-in to date" />
        <StatBlock
          label="Cost / hour"
          value={<Pkr value={summary.costPerHourPkr} />}
          caption={
            summary.benchmarkCostPerHourPkr
              ? `vs benchmark ${summary.benchmarkCostPerHourPkr} (${summary.benchmarkDeltaPct ?? 0}%)`
              : 'no benchmark'
          }
        />
        <StatBlock label="Book value" value={<Pkr value={summary.bookValuePkr} />} caption={`${summary.totalHoursRun.toFixed(0)}h run`} />
        <StatBlock
          label="Replace vs repair"
          value={summary.replaceVsRepairFlag ? 'Review' : 'Healthy'}
          caption="trailing 12m maint vs book"
        />
      </div>

      <SectionDivider label="Cost breakdown" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Depreciation" value={<Pkr value={summary.depreciationPkr} />} />
        <StatBlock label="Maintenance" value={<Pkr value={summary.maintenancePkr} />} />
        <StatBlock label="Repairs" value={<Pkr value={summary.repairsPkr} />} />
        <StatBlock label="Fuel" value={<Pkr value={summary.fuelPkr} />} />
      </div>

      <SectionDivider label="12-month cost trend" />
      <Card>
        <CardContent className="overflow-x-auto p-3">
          <table className="w-full text-sm">
            <thead className="smallcaps text-[var(--zameen-600)]">
              <tr>
                <th className="px-2 py-1 text-left">Month</th>
                <th className="px-2 py-1 text-right">Depreciation</th>
                <th className="px-2 py-1 text-right">Maintenance</th>
                <th className="px-2 py-1 text-right">Repairs</th>
                <th className="px-2 py-1 text-right">Fuel</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((m) => (
                <tr key={m.month} className="border-t">
                  <td className="px-2 py-1">{m.month}</td>
                  <td className="px-2 py-1 text-right"><Pkr value={m.depreciationPkr} /></td>
                  <td className="px-2 py-1 text-right"><Pkr value={m.maintenancePkr} /></td>
                  <td className="px-2 py-1 text-right"><Pkr value={m.repairsPkr} /></td>
                  <td className="px-2 py-1 text-right"><Pkr value={m.fuelPkr} /></td>
                </tr>
              ))}
              {trend.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-[var(--zameen-600)]">
                    No cost activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SectionDivider label="Maintenance plans" />
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="smallcaps text-[var(--zameen-600)]">
                {p.triggerKind.replace(/_/g, ' ')} · every {p.triggerValue ?? '—'}
              </div>
              <div>
                Estimated <Pkr value={Number(p.estimatedCostPkr ?? 0)} />
                {p.estimatedDowntimeHours ? ` · ${p.estimatedDowntimeHours}h downtime` : ''}
              </div>
              <Link
                href={`/assets/maintenance/execute/${p.id}` as never}
                className="smallcaps inline-block pt-1 text-[var(--zameen-700)]"
              >
                Record service →
              </Link>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <p className="text-sm text-[var(--zameen-600)]">No active plans. Add templates from the asset detail page.</p>
        )}
      </div>

      <SectionDivider label="Execution history" />
      <Card>
        <CardContent className="overflow-x-auto p-3">
          <table className="w-full text-sm">
            <thead className="smallcaps text-[var(--zameen-600)]">
              <tr>
                <th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-right">Hour meter</th>
                <th className="px-2 py-1 text-right">Parts</th>
                <th className="px-2 py-1 text-right">Labor</th>
                <th className="px-2 py-1 text-right">External</th>
                <th className="px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="px-2 py-1">{h.executedOn}</td>
                  <td className="px-2 py-1 text-right">{h.hourMeterAtService ?? '—'}</td>
                  <td className="px-2 py-1 text-right"><Pkr value={Number(h.partsCostPkr ?? 0)} /></td>
                  <td className="px-2 py-1 text-right"><Pkr value={Number(h.laborCostPkr ?? 0)} /></td>
                  <td className="px-2 py-1 text-right"><Pkr value={Number(h.externalServiceCostPkr ?? 0)} /></td>
                  <td className="px-2 py-1 text-right"><Pkr value={Number(h.totalCostPkr)} /></td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-center text-[var(--zameen-600)]">
                    No services logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
