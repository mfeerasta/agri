/**
 * Feasibility studies list. Filter by decision state.
 * Director-only approvals: see DEFAULT_APPROVAL_THRESHOLDS_PKR.feasibility_study.
 */
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, feasibilityStudies } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ decision?: string }>;
}

export default async function FeasibilitiesPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view feasibilities.</div>;
  const { decision } = await searchParams;

  const rows = await db
    .select()
    .from(feasibilityStudies)
    .where(decision ? eq(feasibilityStudies.decision, decision) : eq(feasibilityStudies.entityId, session.entityId))
    .orderBy(desc(feasibilityStudies.createdAt))
    .limit(100);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feasibility studies</h1>
        <Link
          href="/feasibilities/new"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New study
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        {(['', 'approved', 'conditional_approval', 'rejected', 'deferred'] as const).map((d) => {
          const label = d === '' ? 'All' : d.replace('_', ' ');
          const href = d === '' ? '/feasibilities' : `/feasibilities?decision=${d}`;
          const active = (decision ?? '') === d;
          return (
            <Link
              key={d || 'all'}
              href={href}
              className={`rounded border px-3 py-1 ${
                active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Capex (PKR)</th>
              <th className="px-3 py-2">Opex (PKR)</th>
              <th className="px-3 py-2">Decision</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                  No feasibility studies yet.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono">
                  <Link href={`/feasibilities/${s.id}`}>{s.studyNumber}</Link>
                </td>
                <td className="px-3 py-2">{s.title}</td>
                <td className="px-3 py-2 tabular-nums">{Number(s.capexEstimatePkr).toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">{Number(s.opexEstimatePkr).toLocaleString()}</td>
                <td className="px-3 py-2">{s.decision ?? 'pending'}</td>
                <td className="px-3 py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
