import Link from 'next/link';
import { desc, eq, sql, and } from 'drizzle-orm';
import {
  db,
  carbonAssessments,
  carbonCredits,
  sustainabilityPractices,
  esgMetricsSnapshots,
} from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, StatBlock, SectionDivider, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { sustainabilityScore, type CarbonFootprintResult } from '@zameen/finance';

export const dynamic = 'force-dynamic';

export default async function SustainabilityHome() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  if (!entityId) {
    return <EmptyState title="No entity in session" description="Sign in to view sustainability data." />;
  }

  const [latestAssessment] = await db
    .select()
    .from(carbonAssessments)
    .where(eq(carbonAssessments.entityId, entityId))
    .orderBy(desc(carbonAssessments.assessmentDate))
    .limit(1);

  const [creditTotals] = await db
    .select({
      issuedTons: sql<number>`coalesce(sum(case when ${carbonCredits.status} = 'issued' then ${carbonCredits.quantityTco2e}::numeric else 0 end), 0)`,
      soldTons: sql<number>`coalesce(sum(case when ${carbonCredits.status} in ('sold','transferred') then ${carbonCredits.quantityTco2e}::numeric else 0 end), 0)`,
      retiredTons: sql<number>`coalesce(sum(case when ${carbonCredits.status} = 'retired' then ${carbonCredits.quantityTco2e}::numeric else 0 end), 0)`,
      revenuePkr: sql<number>`coalesce(sum(${carbonCredits.totalRevenuePkr}::numeric), 0)`,
    })
    .from(carbonCredits)
    .where(eq(carbonCredits.entityId, entityId));

  const [practiceCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sustainabilityPractices)
    .where(and(eq(sustainabilityPractices.entityId, entityId), eq(sustainabilityPractices.isActive, true)));

  const [latestEsg] = await db
    .select()
    .from(esgMetricsSnapshots)
    .where(eq(esgMetricsSnapshots.entityId, entityId))
    .orderBy(desc(esgMetricsSnapshots.snapshotDate))
    .limit(1);

  let score = 0;
  if (latestAssessment) {
    const fp = {
      entityId,
      fromDate: latestAssessment.assessmentDate,
      toDate: latestAssessment.assessmentDate,
      scopeCo2eTons: latestAssessment.scopeCo2eTons as CarbonFootprintResult['scopeCo2eTons'],
      totalEmissionsCo2eTons: Number(latestAssessment.totalEmissionsCo2eTons),
      totalSequestrationCo2eTons: Number(latestAssessment.totalSequestrationCo2eTons),
      netCo2eTons: Number(latestAssessment.netCo2eTons),
      notes: [],
    };
    score = sustainabilityScore(fp);
  }

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Sustainability" subtitle="Carbon, credits, and ESG reporting" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Sustainability score" value={`${score}/100`} />
        <StatBlock
          label="Net CO2e (latest)"
          value={latestAssessment ? `${Number(latestAssessment.netCo2eTons).toFixed(2)} t` : '—'}
        />
        <StatBlock label="Active practices" value={String(practiceCount?.n ?? 0)} />
        <StatBlock label="Credits sold/retired" value={`${Number(creditTotals?.soldTons ?? 0) + Number(creditTotals?.retiredTons ?? 0)} tCO2e`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Carbon footprint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {latestAssessment ? (
              <>
                <div className="text-sm">Assessed on {latestAssessment.assessmentDate}</div>
                <div className="text-sm">Emissions: {Number(latestAssessment.totalEmissionsCo2eTons).toFixed(2)} t</div>
                <div className="text-sm">Sequestration: {Number(latestAssessment.totalSequestrationCo2eTons).toFixed(2)} t</div>
                <div className="text-sm">
                  Net: {Number(latestAssessment.netCo2eTons).toFixed(2)} t
                  {latestAssessment.reductionVsBaselinePct != null && (
                    <span className="ml-2 text-zinc-500">
                      ({Number(latestAssessment.reductionVsBaselinePct).toFixed(1)}% vs {latestAssessment.baselineYear})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <EmptyState title="No assessments yet" description="Run a carbon footprint to begin." />
            )}
            <Link className="text-sm underline" href="/sustainability/carbon-footprint">
              Open carbon footprint
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carbon credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">Issued (available): {Number(creditTotals?.issuedTons ?? 0)} tCO2e</div>
            <div className="text-sm">Sold/transferred: {Number(creditTotals?.soldTons ?? 0)} tCO2e</div>
            <div className="text-sm">Retired: {Number(creditTotals?.retiredTons ?? 0)} tCO2e</div>
            <div className="text-sm">
              Total revenue: <Pkr value={Math.round(Number(creditTotals?.revenuePkr ?? 0) * 100)} />
            </div>
            <Link className="text-sm underline" href="/sustainability/credits">
              Open credit ledger
            </Link>
          </CardContent>
        </Card>
      </div>

      <SectionDivider />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-2">{practiceCount?.n ?? 0} regenerative practice(s) registered.</div>
            <Link className="text-sm underline" href="/sustainability/practices">
              Manage practices
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ESG snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {latestEsg ? (
              <>
                <div className="text-sm">Latest: {latestEsg.snapshotDate} ({latestEsg.framework})</div>
                <div className="text-xs text-zinc-500">
                  Period: {latestEsg.periodStart} to {latestEsg.periodEnd}
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-500">No ESG snapshots yet.</div>
            )}
            <Link className="text-sm underline" href="/sustainability/esg-report">
              Open ESG report
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
