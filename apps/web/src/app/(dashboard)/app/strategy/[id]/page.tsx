/**
 * Plan detail with 4 tabs: initiatives, crop rotation, capex timeline, simulations.
 * Tabs are rendered inline (server-driven via ?tab=).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadStrategicPlan } from '@/modules/strategy/actions';
import { ActivatePlanButton } from '@/modules/strategy/components/activate-plan-button';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const TABS = ['initiatives', 'rotation', 'capex', 'simulations'] as const;
type Tab = (typeof TABS)[number];

export default async function StrategicPlanPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const data = await loadStrategicPlan(id);
  if (!data) return notFound();
  const { plan, initiatives, rotations, simulations } = data;
  const active: Tab = (TABS as readonly string[]).includes(tab ?? '') ? (tab as Tab) : 'initiatives';

  const totalInvestment = initiatives.reduce(
    (s, i) => s + Number(i.estimatedInvestmentPkr ?? 0),
    0,
  );
  const totalReturn = initiatives.reduce((s, i) => s + Number(i.expectedReturnPkr ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/strategy" className="text-sm text-slate-500 hover:underline">
            ← All strategic plans
          </Link>
          <h1 className="text-2xl font-semibold">{plan.name}</h1>
          <div className="text-sm text-slate-500">
            Years {plan.startYear}–{plan.startYear + plan.horizonYears - 1} · Status:{' '}
            <span className="font-medium">{plan.status}</span>
          </div>
          {plan.visionStatement && <p className="mt-2 max-w-2xl text-sm text-slate-700">{plan.visionStatement}</p>}
        </div>
        <div className="flex gap-2">
          {plan.status !== 'active' && plan.status !== 'archived' && <ActivatePlanButton planId={plan.id} />}
          <Link
            href={`/strategy/${plan.id}/initiatives/new`}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Propose initiative
          </Link>
          <Link
            href={`/strategy/${plan.id}/simulate`}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Run simulation
          </Link>
          <Link
            href={`/strategy/${plan.id}/rotation`}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Crop rotation
          </Link>
          <a
            href={`/api/strategy/${plan.id}/report`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Download PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card label="Initiatives" value={initiatives.length.toString()} />
        <Card label="Crop rotation plans" value={rotations.length.toString()} />
        <Card label="Total investment (PKR)" value={totalInvestment.toLocaleString()} />
        <Card label="Total expected return (PKR)" value={totalReturn.toLocaleString()} />
      </div>

      <div className="flex gap-2 border-b border-slate-200 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/strategy/${plan.id}?tab=${t}`}
            className={`-mb-px border-b-2 px-3 py-2 ${
              active === t ? 'border-emerald-600 font-medium text-emerald-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'capex' ? 'Capex timeline' : t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>

      {active === 'initiatives' && (
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Years</th>
                <th className="px-3 py-2">Investment (PKR)</th>
                <th className="px-3 py-2">IRR %</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {initiatives.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No initiatives yet.
                  </td>
                </tr>
              )}
              {initiatives.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{i.name}</td>
                  <td className="px-3 py-2">{i.category}</td>
                  <td className="px-3 py-2">
                    {i.startYear}–{i.endYear}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {i.estimatedInvestmentPkr ? Number(i.estimatedInvestmentPkr).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{i.expectedIrrPct ?? '—'}</td>
                  <td className="px-3 py-2">{i.priority}</td>
                  <td className="px-3 py-2">{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active === 'rotation' && (
        <RotationTab planId={plan.id} startYear={plan.startYear} horizonYears={plan.horizonYears} rotations={rotations} />
      )}

      {active === 'capex' && (
        <CapexTimeline initiatives={initiatives} startYear={plan.startYear} horizonYears={plan.horizonYears} />
      )}

      {active === 'simulations' && (
        <div className="overflow-hidden rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">Base year</th>
                <th className="px-3 py-2">Horizon</th>
                <th className="px-3 py-2">NPV (PKR)</th>
                <th className="px-3 py-2">IRR %</th>
                <th className="px-3 py-2">Payback (yrs)</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {simulations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No simulations run yet.
                  </td>
                </tr>
              )}
              {simulations.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{s.scenarioName}</td>
                  <td className="px-3 py-2">{s.baseYear}</td>
                  <td className="px-3 py-2">{s.horizonYears}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {s.netPresentValuePkr ? Number(s.netPresentValuePkr).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{s.internalRateOfReturnPct ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{s.paybackYears ?? '—'}</td>
                  <td className="px-3 py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CapexTimeline({
  initiatives,
  startYear,
  horizonYears,
}: {
  initiatives: { id: string; name: string; category: string; startYear: number; endYear: number; estimatedInvestmentPkr: string | null; priority: string }[];
  startYear: number;
  horizonYears: number;
}) {
  const years = Array.from({ length: horizonYears }, (_, i) => startYear + i);
  const capex = initiatives.filter((i) => i.category === 'capex' || i.category === 'expansion' || i.category === 'technology');
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white p-3">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600">
            <th className="px-3 py-2">Initiative</th>
            {years.map((y) => (
              <th key={y} className="px-3 py-2 text-center">
                {y}
              </th>
            ))}
            <th className="px-3 py-2">Investment</th>
          </tr>
        </thead>
        <tbody>
          {capex.length === 0 && (
            <tr>
              <td colSpan={years.length + 2} className="px-3 py-6 text-center text-slate-500">
                No capex/expansion initiatives yet.
              </td>
            </tr>
          )}
          {capex.map((i) => (
            <tr key={i.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{i.name}</td>
              {years.map((y) => (
                <td key={y} className="px-1 py-2">
                  {y >= i.startYear && y <= i.endYear ? (
                    <div className={`h-3 rounded ${i.priority === 'critical' ? 'bg-rose-500' : i.priority === 'high' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  ) : null}
                </td>
              ))}
              <td className="px-3 py-2 tabular-nums">
                {i.estimatedInvestmentPkr ? Number(i.estimatedInvestmentPkr).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RotationTab({
  planId,
  startYear,
  horizonYears,
  rotations,
}: {
  planId: string;
  startYear: number;
  horizonYears: number;
  rotations: { id: string; fieldId: string; rotationSchedule: { year: number; cropCode: string }[]; rotationKind: string | null }[];
}) {
  const years = Array.from({ length: horizonYears }, (_, i) => startYear + i);
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <div className="text-slate-600">Quick view — open the rotation editor for drag-and-drop.</div>
        <Link href={`/strategy/${planId}/rotation`} className="text-emerald-700 hover:underline">
          Open editor →
        </Link>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-600">
            <th className="px-3 py-2">Field</th>
            {years.map((y) => (
              <th key={y} className="px-3 py-2 text-center">
                {y}
              </th>
            ))}
            <th className="px-3 py-2">Kind</th>
          </tr>
        </thead>
        <tbody>
          {rotations.length === 0 && (
            <tr>
              <td colSpan={years.length + 2} className="px-3 py-6 text-center text-slate-500">
                No rotation plans yet.
              </td>
            </tr>
          )}
          {rotations.map((r) => {
            const byYear = new Map(r.rotationSchedule.map((s) => [s.year, s.cropCode]));
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.fieldId.slice(0, 8)}</td>
                {years.map((y) => (
                  <td key={y} className="px-3 py-2 text-center text-xs">
                    {byYear.get(y) ?? '—'}
                  </td>
                ))}
                <td className="px-3 py-2">{r.rotationKind ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
