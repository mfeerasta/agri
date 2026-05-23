import { notFound } from 'next/navigation';
import { asc, desc, eq, or, isNull, and } from 'drizzle-orm';
import { db, kpiActuals, kpiDefinitions } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState, StatBlock } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { RecordActualForm } from './record-actual-form';

export const dynamic = 'force-dynamic';

export default async function KpiDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) return <EmptyState title="No entity" description="Sign in." />;

  const [def] = await db
    .select()
    .from(kpiDefinitions)
    .where(and(eq(kpiDefinitions.id, id), or(isNull(kpiDefinitions.entityId), eq(kpiDefinitions.entityId, entityId))));
  if (!def) notFound();

  const actuals = await db
    .select()
    .from(kpiActuals)
    .where(eq(kpiActuals.kpiId, id))
    .orderBy(desc(kpiActuals.periodEnd))
    .limit(36);

  const trend = [...actuals].reverse();
  const maxVal = Math.max(1, ...trend.map((a) => Math.abs(Number(a.value))));
  const latest = actuals[0];

  return (
    <div className="p-6 space-y-6">
      <Masthead title={def.name} subtitle={`${def.category} · ${def.unit}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Code" value={def.code} />
        <StatBlock label="Target" value={def.targetValue ?? '—'} />
        <StatBlock label="Latest" value={latest ? `${Number(latest.value)}` : '—'} />
        <StatBlock label="Variance" value={latest?.variancePct == null ? '—' : `${Number(latest.variancePct)}%`} />
      </div>

      {def.formulaDescription ? (
        <Card>
          <CardHeader><CardTitle>Formula</CardTitle></CardHeader>
          <CardContent className="text-sm">{def.formulaDescription}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Record actual</CardTitle></CardHeader>
        <CardContent>
          <RecordActualForm kpiId={def.id} unit={def.unit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trend</CardTitle></CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState title="No actuals yet" description="Record one to see the trend." />
          ) : (
            <div>
              <div className="flex items-end gap-1 h-32 border-b pb-1">
                {trend.map((a) => {
                  const h = Math.max(2, (Math.abs(Number(a.value)) / maxVal) * 120);
                  const color = a.variancePct != null && Number(a.variancePct) < -10 ? 'bg-red-600' : 'bg-emerald-700';
                  return (
                    <div key={a.id} title={`${a.periodEnd}: ${a.value}`} className={`${color} w-3`} style={{ height: `${h}px` }} />
                  );
                })}
              </div>
              <table className="w-full text-sm mt-4">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="py-1">Period</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Target</th>
                    <th className="text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {actuals.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-1">{a.periodStart} → {a.periodEnd}</td>
                      <td className="text-right">{Number(a.value)}</td>
                      <td className="text-right">{a.targetValue == null ? '—' : Number(a.targetValue)}</td>
                      <td className="text-right">{a.variancePct == null ? '—' : `${Number(a.variancePct)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
