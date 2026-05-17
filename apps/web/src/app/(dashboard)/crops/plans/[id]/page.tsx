import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, cropPlans, cropProfiles, fields, cropStageLogs, harvestRecords, inputIssuances } from '@zameen/db';
import { desc, eq, sql } from 'drizzle-orm';
import { computeFieldPnL } from '@zameen/finance';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Masthead,
  Pkr,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CropPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan] = await db
    .select({
      id: cropPlans.id,
      fieldId: cropPlans.fieldId,
      cropName: cropProfiles.name,
      cropNameUr: cropProfiles.nameUr,
      varietyName: cropPlans.varietyName,
      season: cropPlans.season,
      seasonLabel: cropPlans.seasonLabel,
      plannedAcres: cropPlans.plannedAcres,
      currentStage: cropPlans.currentStage,
      plannedSowingDate: cropPlans.plannedSowingDate,
      stageTimeline: cropProfiles.stageTimeline,
      fieldCode: fields.code,
      fieldName: fields.name,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .where(eq(cropPlans.id, id))
    .limit(1);
  if (!plan) notFound();

  const stages = await db
    .select()
    .from(cropStageLogs)
    .where(eq(cropStageLogs.cropPlanId, id))
    .orderBy(desc(cropStageLogs.observedOn));
  const harvests = await db.select().from(harvestRecords).where(eq(harvestRecords.cropPlanId, id));
  const inputs = await db
    .select({ total: sql<string>`COALESCE(SUM(${inputIssuances.totalCostPkr}),0)` })
    .from(inputIssuances)
    .where(eq(inputIssuances.cropPlanId, id));
  const inputsCost = Number(inputs[0]?.total ?? 0);

  const pnl = await computeFieldPnL(id);

  return (
    <div className="space-y-2">
      <Masthead section={`PLAN / ${plan.fieldCode}`} />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {plan.fieldCode} · {plan.cropName} {plan.varietyName ? `· ${plan.varietyName}` : ''}
          </h1>
          <p className="text-sm text-slate-500">{plan.seasonLabel} · sown {fmtDate(plan.plannedSowingDate)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/crops/plans/${id}/stages/log` as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
            Log stage
          </Link>
          <Link href={`/crops/plans/${id}/harvest/new` as never} className="rounded-md bg-amber-700 px-4 py-2 text-sm text-white">
            Log harvest
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Acres" value={Number(plan.plannedAcres).toFixed(2)} />
        <StatBlock label="Current stage" value={plan.currentStage} />
        <StatBlock label="Inputs cost" value={<Pkr value={inputsCost} mode="lac_crore" />} />
        <StatBlock label="Net P&L" value={pnl ? <Pkr value={pnl.netPkr} mode="lac_crore" /> : '—'} />
      </div>

      <SectionDivider label="Stage timeline" />
      <Card>
        <CardContent className="p-0">
          {stages.length === 0 ? (
            <EmptyState title="No stage logs yet" />
          ) : (
            <ul>
              {stages.map((s) => (
                <li key={s.id} className="border-b border-[var(--rule)] px-5 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-body">{s.stage}</span>
                    <span className="tabular text-xs text-slate-500">{fmtDate(s.observedOn)}</span>
                  </div>
                  {s.notes ? <p className="mt-1 text-sm text-slate-600">{s.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Harvests" />
      <Card>
        <CardContent className="p-0">
          {harvests.length === 0 ? (
            <EmptyState title="No harvests logged" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Date</th><th className="p-3">Acres</th><th className="p-3">Yield (kg)</th><th className="p-3">Moisture %</th></tr>
              </thead>
              <tbody>
                {harvests.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">{fmtDate(h.harvestedOn)}</td>
                    <td className="p-3 tabular">{Number(h.acresHarvested).toFixed(2)}</td>
                    <td className="p-3 tabular">{Number(h.grossYieldKg).toFixed(0)}</td>
                    <td className="p-3 tabular">{h.moisturePct ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Timeline (from crop profile)" />
      <Card>
        <CardHeader><CardTitle>Expected stages</CardTitle></CardHeader>
        <CardContent>
          {plan.stageTimeline ? (
            <pre className="overflow-auto text-xs">{JSON.stringify(plan.stageTimeline, null, 2)}</pre>
          ) : (
            <EmptyState title="No timeline on crop profile" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
