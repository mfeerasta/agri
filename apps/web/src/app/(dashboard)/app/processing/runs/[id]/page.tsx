/**
 * Run detail: shows recipe, actual vs expected yield, cost breakdown,
 * per-output unit cost, and byproduct disposition.
 */
import Link from 'next/link';
import { loadRun } from '@/modules/processing/actions';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

function pkr(n: number | string | null): string {
  if (n === null || n === undefined) return '-';
  const v = typeof n === 'string' ? Number(n) : n;
  return `PKR ${v.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view this run.</div>;
  const { id } = await params;
  const data = await loadRun(id);
  if (!data) return <div className="p-6">Run not found.</div>;
  const { run, recipe, byproducts } = data;

  const expected = run.varianceFromExpectedPct ? Number(run.varianceFromExpectedPct) : null;
  const inefficiency = expected !== null && expected < -5;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{recipe?.name ?? 'Processing run'}</h1>
          <p className="text-sm text-slate-500">
            Started {new Date(run.startedAt).toLocaleString()}{' '}
            {run.endedAt ? `- ended ${new Date(run.endedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <Link href="/processing/runs/new" className="text-sm text-emerald-700 hover:underline">
          New run
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Actual yield</div>
          <div className="text-2xl font-semibold">
            {run.actualYieldPct ? `${Number(run.actualYieldPct).toFixed(1)}%` : '-'}
          </div>
          {expected !== null && (
            <div className={`text-sm ${inefficiency ? 'text-rose-600' : 'text-slate-500'}`}>
              {expected > 0 ? '+' : ''}
              {expected.toFixed(1)} pp vs expected
            </div>
          )}
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Total run cost</div>
          <div className="text-2xl font-semibold">{pkr(run.totalRunCostPkr)}</div>
          <div className="text-xs text-slate-500">Inputs + energy + labour + overhead</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Status</div>
          <div className="text-2xl font-semibold">
            {inefficiency ? (
              <span className="text-rose-600">Inefficient</span>
            ) : (
              <span className="text-emerald-700">On track</span>
            )}
          </div>
          <div className="text-xs text-slate-500">Variance flag at -5pp</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="font-semibold mb-2">Cost breakdown</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">Inputs</dt>
            <dd className="text-right">{pkr(run.totalInputCostPkr)}</dd>
            <dt className="text-slate-500">Energy</dt>
            <dd className="text-right">{pkr(run.energyCostPkr)}</dd>
            <dt className="text-slate-500">Labour</dt>
            <dd className="text-right">{pkr(run.labourCostPkr)}</dd>
            <dt className="text-slate-500">Overhead</dt>
            <dd className="text-right">{pkr(run.overheadCostPkr)}</dd>
            <dt className="font-medium border-t pt-1 mt-1">Total</dt>
            <dd className="text-right font-medium border-t pt-1 mt-1">{pkr(run.totalRunCostPkr)}</dd>
          </dl>
        </div>

        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="font-semibold mb-2">Per-output unit cost</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Output</th>
                <th className="py-1 text-right">kg</th>
                <th className="py-1 text-right">PKR/kg</th>
              </tr>
            </thead>
            <tbody>
              {run.outputsProduced.map((o) => (
                <tr key={o.name} className="border-t border-slate-100">
                  <td className="py-1">{o.name}</td>
                  <td className="py-1 text-right">{o.quantityKg.toLocaleString()}</td>
                  <td className="py-1 text-right">
                    {pkr(run.perUnitOutputCostPkr?.[o.name] ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {byproducts.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="font-semibold mb-2">Byproducts</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Kind</th>
                <th className="py-1 text-right">kg</th>
                <th className="py-1 text-right">Unit value</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {byproducts.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-1">{b.byproductKind}</td>
                  <td className="py-1 text-right">{Number(b.quantityKg).toLocaleString()}</td>
                  <td className="py-1 text-right">{pkr(b.unitValuePkr)}</td>
                  <td className="py-1">{b.disposedOn ? b.disposalKind : 'still held'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/processing/byproducts" className="text-sm text-emerald-700 hover:underline">
            Manage dispositions
          </Link>
        </div>
      )}

      {run.notes && (
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="font-semibold mb-1">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{run.notes}</p>
        </div>
      )}
    </div>
  );
}
