import Link from 'next/link';
import { asc, eq, or, isNull } from 'drizzle-orm';
import { db, kpiDefinitions } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function KpisPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) return <EmptyState title="No entity" description="Sign in." />;

  const rows = await db
    .select()
    .from(kpiDefinitions)
    .where(or(isNull(kpiDefinitions.entityId), eq(kpiDefinitions.entityId, entityId)))
    .orderBy(asc(kpiDefinitions.category), asc(kpiDefinitions.code));

  return (
    <div className="p-6 space-y-6">
      <Masthead title="KPI catalog" subtitle="Definitions, targets, and actuals" />
      <Card>
        <CardHeader>
          <CardTitle>KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No KPIs" description="Standard catalog should seed from migration." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Target</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">
                      <Link href={`/stakeholders/kpis/${r.id}`} className="underline">
                        {r.code}
                      </Link>
                    </td>
                    <td>{r.name}</td>
                    <td>{r.category}</td>
                    <td>{r.unit}</td>
                    <td>{r.targetValue ?? '—'}</td>
                    <td>{r.targetPeriod ?? '—'}</td>
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
