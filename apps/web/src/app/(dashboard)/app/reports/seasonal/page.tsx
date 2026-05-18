import { desc } from 'drizzle-orm';
import { db, cropPlans } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr, EmptyState } from '@zameen/ui';
import { buildSeasonalReportData } from '@/lib/reports/seasonal-report';
import { getSessionContext } from '@/lib/session';
import { ExportButtons } from '@/components/export-buttons';
import { fmtNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SeasonalReport({ searchParams }: { searchParams: Promise<{ seasonLabel?: string }> }) {
  const { seasonLabel: requested } = await searchParams;
  const session = await getSessionContext();

  if (!session) {
    return (
      <div>
        <Masthead section="SEASONAL REVIEW" />
        <SectionDivider />
        <EmptyState title="Sign in required" body="Sign in to view seasonal reports." />
      </div>
    );
  }

  const latest = await db
    .select({ seasonLabel: cropPlans.seasonLabel })
    .from(cropPlans)
    .orderBy(desc(cropPlans.createdAt))
    .limit(1);
  const seasonLabel = requested ?? latest[0]?.seasonLabel;

  if (!seasonLabel) {
    return (
      <div>
        <Masthead section="SEASONAL REVIEW" />
        <SectionDivider />
        <EmptyState title="No seasons yet" body="Create a crop plan to start collecting seasonal data." />
      </div>
    );
  }

  const data = await buildSeasonalReportData(session.entityId, seasonLabel);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Masthead section="SEASONAL REVIEW" />
        <ExportButtons
          endpoint="/api/exports/seasonal-report"
          query={{ seasonLabel, entityId: session.entityId }}
          label="Download"
        />
      </div>
      <SectionDivider />

      <div className="mb-3 flex justify-between smallcaps text-xs text-[var(--ink)]/70">
        <span>Season: {seasonLabel} · {data.rows.length} plans · {fmtNumber(data.totals.acres)} acres</span>
        <span>
          Revenue <Pkr value={data.totals.revenuePkr} mode="lac_crore" /> ·
          Cost <Pkr value={data.totals.totalCostPkr} mode="lac_crore" /> ·
          Margin <Pkr value={data.totals.grossMarginPkr} mode="lac_crore" />
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>Per-field P&amp;L</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No crop plans in this season yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Field</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Crop</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Acres</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Yield kg</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Revenue</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Cost</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Margin / acre</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.cropPlanId} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 font-mono text-xs">{r.fieldCode}</td>
                    <td className="px-3 py-2">{r.cropName}</td>
                    <td className="px-3 py-2 text-right tabular">{r.acres.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular">{r.yieldKg.toFixed(0)}</td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.revenuePkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.totalCostPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.grossMarginPkr} /></td>
                    <td className="px-3 py-2 text-right"><Pkr value={r.marginPerAcrePkr} /></td>
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
