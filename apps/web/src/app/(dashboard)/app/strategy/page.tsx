/**
 * Strategic plans list. Shows current active plan summary + history.
 */
import Link from 'next/link';
import { listStrategicPlans } from '@/modules/strategy/actions';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function StrategyPage() {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view strategic plans.</div>;
  const plans = await listStrategicPlans();
  const active = plans.find((p) => p.status === 'active');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Strategic planning</h1>
          <p className="text-sm text-slate-500">5-year roadmap, crop rotation, capex initiatives, and scenario simulations.</p>
        </div>
        <Link
          href="/strategy/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New plan
        </Link>
      </div>

      {active && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Active plan</div>
          <Link href={`/strategy/${active.id}`} className="text-lg font-semibold hover:underline">
            {active.name}
          </Link>
          <div className="text-sm text-slate-600">
            Years {active.startYear}–{active.startYear + active.horizonYears - 1}
          </div>
          {active.visionStatement && <p className="mt-2 text-sm text-slate-700">{active.visionStatement}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Horizon</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  No strategic plans yet. Create your first 5-year roadmap.
                </td>
              </tr>
            )}
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/strategy/${p.id}`}>{p.name}</Link>
                </td>
                <td className="px-3 py-2">
                  {p.startYear}–{p.startYear + p.horizonYears - 1}
                </td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
