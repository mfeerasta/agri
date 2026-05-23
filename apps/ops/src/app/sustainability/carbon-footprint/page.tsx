import { desc, eq } from 'drizzle-orm';
import { db, carbonAssessments } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { runCarbonAssessment } from '../actions';
import type { ScopeBreakdown } from '@zameen/finance';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function quarterStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

export default async function CarbonFootprintPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';

  const rows = entityId
    ? await db
        .select()
        .from(carbonAssessments)
        .where(eq(carbonAssessments.entityId, entityId))
        .orderBy(desc(carbonAssessments.assessmentDate))
        .limit(40)
    : [];

  async function runAction(formData: FormData) {
    'use server';
    await runCarbonAssessment({
      entityId: formData.get('entityId'),
      fieldId: (formData.get('fieldId') as string) || null,
      assessmentDate: formData.get('assessmentDate'),
      fromDate: formData.get('fromDate'),
      toDate: formData.get('toDate'),
      estimatedTubewellKwh: formData.get('kwh') ? Number(formData.get('kwh')) : undefined,
      estimatedInputTransportTonKm: formData.get('tonKm') ? Number(formData.get('tonKm')) : undefined,
      baselineYear: formData.get('baselineYear') ? Number(formData.get('baselineYear')) : undefined,
      methodology: (formData.get('methodology') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Carbon footprint" subtitle="Periodic emissions and sequestration" />

      <Card>
        <CardHeader>
          <CardTitle>Run assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={runAction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="hidden" name="entityId" value={entityId} />
            <label className="text-sm">
              Assessment date
              <input type="date" required name="assessmentDate" defaultValue={todayIso()} className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              From
              <input type="date" required name="fromDate" defaultValue={quarterStart()} className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              To
              <input type="date" required name="toDate" defaultValue={todayIso()} className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Estimated tubewell kWh
              <input type="number" min="0" step="1" name="kwh" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Input transport (ton-km)
              <input type="number" min="0" step="1" name="tonKm" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Baseline year (optional)
              <input type="number" min="1990" max="2100" name="baselineYear" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm md:col-span-3">
              Methodology
              <input name="methodology" defaultValue="IPCC tier-1 + farm activity data" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm md:col-span-3">
              Notes
              <textarea name="notes" rows={2} className="block w-full border rounded p-2 text-sm" />
            </label>
            <div className="md:col-span-3">
              <button type="submit" className="rounded bg-emerald-700 text-white px-3 py-2 text-sm">
                Compute footprint
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No assessments yet" description="Run a carbon footprint assessment above." />
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-1">Date</th>
                  <th>Emissions (t)</th>
                  <th>Sequestration (t)</th>
                  <th>Net (t)</th>
                  <th>Δ vs baseline</th>
                  <th>Scope-1 / 2 / 3</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = r.scopeCo2eTons as ScopeBreakdown;
                  const s1 = s.scope1.dieselCombustion + s.scope1.entericMethane + s.scope1.riceMethane + s.scope1.manureManagement;
                  const s2 = s.scope2.gridElectricity;
                  const s3 = s.scope3.fertilizerN2o + s.scope3.inputTransport;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="py-1">{r.assessmentDate}</td>
                      <td>{Number(r.totalEmissionsCo2eTons).toFixed(2)}</td>
                      <td>{Number(r.totalSequestrationCo2eTons).toFixed(2)}</td>
                      <td>{Number(r.netCo2eTons).toFixed(2)}</td>
                      <td>{r.reductionVsBaselinePct ? `${Number(r.reductionVsBaselinePct).toFixed(1)}%` : '—'}</td>
                      <td className="text-xs text-zinc-600">
                        {s1.toFixed(2)} / {s2.toFixed(2)} / {s3.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
