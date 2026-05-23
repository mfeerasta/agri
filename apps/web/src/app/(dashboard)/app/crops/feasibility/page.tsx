import Link from 'next/link';
import { listStudies } from '@/modules/feasibility/actions';
import { getSessionContext } from '@/lib/session';
import { NewStudyForm } from '@/modules/feasibility/components/new-study-form';

export const dynamic = 'force-dynamic';

export default async function FeasibilityListPage() {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view feasibility studies.</div>;
  const studies = await listStudies();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Feasibility planner</h1>
          <p className="text-sm text-slate-600 mt-1">
            Pre-season what-if scenarios. Pick crop and fields, drop in yields, prices and cost
            assumptions, compare side by side.
          </p>
        </div>
        <NewStudyForm />
      </div>

      {studies.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No studies yet. Create one above to start exploring scenarios.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {studies.map((s) => (
            <Link
              key={s.id}
              href={`/app/crops/feasibility/${s.id}` as never}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-600 transition"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                {s.season ?? 'Season not set'} - updated {new Date(s.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
