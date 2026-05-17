import {
  Masthead,
  SectionDivider,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Pkr,
  EmptyState,
  StatBlock,
  DeltaPill,
  ChartCard,
} from '@zameen/ui';
import { buildYoYReportData, listSeasonLabels } from '@/lib/reports/yoy-report';
import { getSessionContext } from '@/lib/session';
import { ExportButtons } from '@/components/export-buttons';
import { fmtNumber } from '@/lib/format';
import { SeasonSelector } from './season-selector';

export const dynamic = 'force-dynamic';

interface SearchParams {
  currentSeason?: string;
  previousSeason?: string;
}

export default async function YearOverYearPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (!session) {
    return (
      <div>
        <Masthead section="YEAR-ON-YEAR" />
        <SectionDivider />
        <EmptyState title="Sign in required" body="Sign in to view year-on-year comparisons." />
      </div>
    );
  }

  const seasons = await listSeasonLabels();
  if (seasons.length === 0) {
    return (
      <div>
        <Masthead section="YEAR-ON-YEAR" />
        <SectionDivider />
        <EmptyState title="No seasons yet" body="Create crop plans across at least two seasons to compare." />
      </div>
    );
  }

  const currentSeason = params.currentSeason ?? seasons[0]!;
  const previousSeason = params.previousSeason ?? (seasons[1] ?? seasons[0]!);

  const data = await buildYoYReportData(session.entityId, currentSeason, previousSeason);

  const compareBars = data.rows.map((r) => ({
    crop: r.cropName,
    current: r.current.yieldPerAcreKg,
    previous: r.previous?.yieldPerAcreKg ?? 0,
  }));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Masthead section="YEAR-ON-YEAR" />
        <ExportButtons
          endpoint="/api/exports/year-over-year"
          query={{ currentSeason, previousSeason, entityId: session.entityId }}
          label="Download"
        />
      </div>
      <SectionDivider />

      <div className="mb-4">
        <SeasonSelector seasons={seasons} currentSeason={currentSeason} previousSeason={previousSeason} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <StatBlock
          label="Revenue YoY"
          value={<Pkr value={data.totalsCurrent.revenuePkr} mode="lac_crore" />}
          caption={`prev ${previousSeason}`}
          delta={<DeltaPill value={data.totalsDelta.revenuePct} desirable="high" />}
        />
        <StatBlock
          label="Cost YoY"
          value={<Pkr value={data.totalsCurrent.totalCostPkr} mode="lac_crore" />}
          caption={`prev ${previousSeason}`}
          delta={<DeltaPill value={data.totalsDelta.costPct} desirable="low" />}
        />
        <StatBlock
          label="Margin YoY"
          value={<Pkr value={data.totalsCurrent.marginPkr} mode="lac_crore" />}
          caption={`prev ${previousSeason}`}
          delta={<DeltaPill value={data.totalsDelta.marginPct} desirable="high" />}
        />
        <StatBlock
          label="Weighted yield / acre"
          value={`${fmtNumber(data.totalsCurrent.weightedYieldPerAcreKg, 0)} kg`}
          caption={`prev ${previousSeason}`}
          delta={<DeltaPill value={data.totalsDelta.yieldPct} desirable="high" />}
        />
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Yield per acre by crop, {currentSeason} vs {previousSeason}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {compareBars.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No crop data in either season.</div>
          ) : (
            <ChartCard
              title=""
              data={compareBars}
              xKey="crop"
              yKey="current"
              unit="kg/acre"
              height={260}
            />
          )}
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader><CardTitle>Per-crop comparison</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Crop</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Yield/acre</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">YoY</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Revenue</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Cost</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Cost YoY</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin/acre</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin YoY</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">vs benchmark</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.cropName} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2">{r.cropName}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtNumber(r.current.yieldPerAcreKg, 0)}</td>
                  <td className="px-3 py-2 text-right"><DeltaPill value={r.yieldDeltaPct} desirable="high" /></td>
                  <td className="px-3 py-2 text-right"><Pkr value={r.current.revenuePkr} /></td>
                  <td className="px-3 py-2 text-right"><Pkr value={r.current.totalCostPkr} /></td>
                  <td className="px-3 py-2 text-right"><DeltaPill value={r.costDeltaPct} desirable="low" /></td>
                  <td className="px-3 py-2 text-right"><Pkr value={r.current.marginPerAcrePkr} /></td>
                  <td className="px-3 py-2 text-right"><DeltaPill value={r.marginDeltaPct} desirable="high" /></td>
                  <td className="px-3 py-2 text-right tabular">{r.yieldVsBenchmarkPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cost-pool trend</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.costPoolTrends.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No cost allocations in selected seasons.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Pool</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">{previousSeason} total</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">{previousSeason} /acre</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">{currentSeason} total</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">{currentSeason} /acre</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">CAGR</th>
                </tr>
              </thead>
              <tbody>
                {data.costPoolTrends.map((p) => {
                  const prev = p.perSeason.find((s) => s.seasonLabel === previousSeason);
                  const curr = p.perSeason.find((s) => s.seasonLabel === currentSeason);
                  return (
                    <tr key={p.costPool} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{p.costPool.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-right"><Pkr value={prev?.totalPkr ?? 0} /></td>
                      <td className="px-3 py-2 text-right"><Pkr value={prev?.perAcrePkr ?? 0} /></td>
                      <td className="px-3 py-2 text-right"><Pkr value={curr?.totalPkr ?? 0} /></td>
                      <td className="px-3 py-2 text-right"><Pkr value={curr?.perAcrePkr ?? 0} /></td>
                      <td className="px-3 py-2 text-right">
                        <DeltaPill value={p.cagr} desirable="low" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
