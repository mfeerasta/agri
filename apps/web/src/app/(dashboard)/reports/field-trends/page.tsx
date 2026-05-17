import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import {
  db,
  fields as fieldsTable,
  blocks as blocksTable,
  farms as farmsTable,
  cropProfiles,
} from '@zameen/db';
import { computeFieldRollingTrend } from '@zameen/finance';
import {
  Masthead,
  SectionDivider,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  EmptyState,
  StatBlock,
  Pkr,
  ChartCard,
} from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { fmtNumber } from '@/lib/format';
import { FieldMatrixTable } from './field-matrix-table';
import { buildFieldMatrix } from '@/lib/reports/field-matrix';

export const dynamic = 'force-dynamic';

interface SearchParams {
  fieldId?: string;
  years?: string;
}

async function listFields(entityId: string): Promise<Array<{ id: string; code: string; acres: number }>> {
  const rows = await db
    .select({ id: fieldsTable.id, code: fieldsTable.code, acres: fieldsTable.acres })
    .from(fieldsTable)
    .innerJoin(blocksTable, eq(blocksTable.id, fieldsTable.blockId))
    .innerJoin(farmsTable, eq(farmsTable.id, blocksTable.farmId))
    .where(eq(farmsTable.entityId, entityId));
  return rows.map((r) => ({ id: r.id, code: r.code, acres: Number(r.acres) }));
}

export default async function FieldTrendsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (!session) {
    return (
      <div>
        <Masthead section="FIELD TRENDS" />
        <SectionDivider />
        <EmptyState title="Sign in required" body="Sign in to view field trends." />
      </div>
    );
  }

  const years = Math.min(10, Math.max(2, Number(params.years ?? '5') || 5));
  const fields = await listFields(session.entityId);

  // Default landing: matrix
  if (!params.fieldId) {
    const matrix = await buildFieldMatrix(session.entityId, years);
    return (
      <div>
        <Masthead section="FIELD TRENDS" />
        <SectionDivider />
        <div className="mb-3 smallcaps text-xs text-[var(--ink)]/70">
          Pick a field to drill in, or use the matrix below.
        </div>
        <Card className="mb-5">
          <CardHeader><CardTitle>Pick a field</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {fields.map((f) => (
                <Link
                  key={f.id}
                  href={`/reports/field-trends?fieldId=${f.id}&years=${years}`}
                  className="rounded border border-[var(--rule)] px-2 py-1 text-xs font-mono hover:bg-[var(--surface-2)]"
                >
                  {f.code} ({f.acres.toFixed(1)} ac)
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{years}-year × {matrix.rows.length}-field margin/acre heatmap</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <FieldMatrixTable matrix={matrix} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const trend = await computeFieldRollingTrend(session.entityId, params.fieldId, years);
  if (trend.perSeason.length === 0) {
    return (
      <div>
        <Masthead section="FIELD TRENDS" />
        <SectionDivider />
        <EmptyState
          title="No history for this field"
          body="No crop plans recorded yet. Plant a crop and log a season to start tracking."
        />
      </div>
    );
  }

  const yieldChart = trend.perSeason.map((s) => ({ season: s.seasonLabel, yieldPerAcre: s.yieldPerAcre }));
  const marginChart = trend.perSeason.map((s) => ({ season: s.seasonLabel, marginPerAcre: s.marginPerAcre }));

  const cropProfileNames = Array.from(new Set(trend.perSeason.map((s) => s.cropName)));
  const profiles = cropProfileNames.length
    ? await db.select().from(cropProfiles).where(inArray(cropProfiles.name, cropProfileNames))
    : [];
  const benchmarkByCrop = new Map(profiles.map((p) => [p.name, p.yieldBenchmarkPerAcre ? Number(p.yieldBenchmarkPerAcre) : null]));

  const trendArrow =
    trend.trendDirection === 'improving' ? '↑' : trend.trendDirection === 'declining' ? '↓' : '→';

  return (
    <div>
      <Masthead section="FIELD TRENDS" />
      <SectionDivider />
      <div className="mb-3 flex items-center gap-2 text-xs">
        <Link
          href={`/reports/field-trends?years=${years}`}
          className="smallcaps text-[var(--ochre)] hover:underline"
        >
          ← Show all fields
        </Link>
      </div>

      <div className="mb-3 smallcaps text-xs text-[var(--ink)]/70">
        Field <span className="font-mono">{trend.fieldCode}</span> · {trend.yearsTracked} season(s) tracked
      </div>

      <div className="grid gap-3 sm:grid-cols-4 mb-5">
        <StatBlock label="Years tracked" value={String(trend.yearsTracked)} />
        <StatBlock label="Best season" value={trend.bestSeason || '—'} caption="highest margin/acre" />
        <StatBlock label="Worst season" value={trend.worstSeason || '—'} caption="lowest margin/acre" />
        <StatBlock label="Trend" value={`${trendArrow} ${trend.trendDirection}`} caption="margin/acre slope" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <ChartCard
          title="Yield per acre across seasons"
          data={yieldChart}
          xKey="season"
          yKey="yieldPerAcre"
          unit="kg/acre"
          height={260}
        />
        <ChartCard
          title="Margin per acre across seasons"
          data={marginChart}
          xKey="season"
          yKey="marginPerAcre"
          unit="PKR/acre"
          height={260}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Crop-rotation history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Season</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Crop</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Yield/acre kg</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Benchmark kg</th>
                <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin/acre</th>
              </tr>
            </thead>
            <tbody>
              {trend.perSeason.map((s) => {
                const bench = benchmarkByCrop.get(s.cropName) ?? null;
                return (
                  <tr key={s.seasonLabel} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{s.seasonLabel}</td>
                    <td className="px-3 py-2">{s.cropName}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtNumber(s.yieldPerAcre, 0)}</td>
                    <td className="px-3 py-2 text-right tabular text-[var(--ink)]/60">
                      {bench !== null ? fmtNumber(bench, 0) : 'n.a.'}
                    </td>
                    <td className="px-3 py-2 text-right"><Pkr value={s.marginPerAcre} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
