/**
 * Scenario builder. Edit assumptions, run simulation, compare results.
 */
import { notFound } from 'next/navigation';
import { loadStrategicPlan } from '@/modules/strategy/actions';
import { ScenarioBuilder } from '@/modules/strategy/components/scenario-builder';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SimulatePage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadStrategicPlan(id);
  if (!data) return notFound();

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Scenario simulator</h1>
        <p className="text-sm text-slate-500">
          Years {data.plan.startYear}–{data.plan.startYear + data.plan.horizonYears - 1}. Run deterministic or Monte Carlo simulations,
          then compare NPV, IRR and payback against past scenarios.
        </p>
      </div>
      <ScenarioBuilder
        planId={data.plan.id}
        baseYear={data.plan.startYear}
        horizonYears={data.plan.horizonYears}
        previousSims={data.simulations.map((s) => ({
          id: s.id,
          scenarioName: s.scenarioName,
          npvPkr: Number(s.netPresentValuePkr ?? 0),
          irrPct: s.internalRateOfReturnPct != null ? Number(s.internalRateOfReturnPct) : null,
          paybackYears: s.paybackYears != null ? Number(s.paybackYears) : null,
        }))}
      />
    </div>
  );
}
