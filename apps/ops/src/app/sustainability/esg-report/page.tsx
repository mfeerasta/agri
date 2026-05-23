import { desc, eq } from 'drizzle-orm';
import { db, esgMetricsSnapshots } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { createEsgSnapshot } from '../actions';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function EsgReportPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  const rows = entityId
    ? await db
        .select()
        .from(esgMetricsSnapshots)
        .where(eq(esgMetricsSnapshots.entityId, entityId))
        .orderBy(desc(esgMetricsSnapshots.snapshotDate))
        .limit(40)
    : [];

  async function snapshotAction(formData: FormData) {
    'use server';
    await createEsgSnapshot({
      entityId: formData.get('entityId'),
      snapshotDate: formData.get('snapshotDate'),
      periodStart: formData.get('periodStart'),
      periodEnd: formData.get('periodEnd'),
      framework: (formData.get('framework') as string) || 'GRI-aligned',
      environmental: {
        netCo2eTons: Number(formData.get('netCo2eTons') ?? 0),
        waterUsedM3: formData.get('waterUsedM3') ? Number(formData.get('waterUsedM3')) : undefined,
        waterSavedM3: formData.get('waterSavedM3') ? Number(formData.get('waterSavedM3')) : undefined,
        renewableEnergyKwh: formData.get('renewableEnergyKwh') ? Number(formData.get('renewableEnergyKwh')) : undefined,
        syntheticFertilizerKg: formData.get('syntheticFertilizerKg') ? Number(formData.get('syntheticFertilizerKg')) : undefined,
        pesticideKg: formData.get('pesticideKg') ? Number(formData.get('pesticideKg')) : undefined,
      },
      social: {
        headcount: Number(formData.get('headcount') ?? 0),
        femaleHeadcountPct: formData.get('femaleHeadcountPct') ? Number(formData.get('femaleHeadcountPct')) : undefined,
        safetyIncidents: formData.get('safetyIncidents') ? Number(formData.get('safetyIncidents')) : undefined,
        trainingHours: formData.get('trainingHours') ? Number(formData.get('trainingHours')) : undefined,
        avgWagePkr: formData.get('avgWagePkr') ? Number(formData.get('avgWagePkr')) : undefined,
        communityInvestmentPkr: formData.get('communityInvestmentPkr') ? Number(formData.get('communityInvestmentPkr')) : undefined,
      },
      governance: {
        boardMeetingsHeld: formData.get('boardMeetingsHeld') ? Number(formData.get('boardMeetingsHeld')) : undefined,
        auditCompleted: formData.get('auditCompleted') === 'on',
        approvalsRecorded: formData.get('approvalsRecorded') ? Number(formData.get('approvalsRecorded')) : undefined,
        grievancesResolvedPct: formData.get('grievancesResolvedPct') ? Number(formData.get('grievancesResolvedPct')) : undefined,
        complianceFilingsOnTimePct: formData.get('complianceFilingsOnTimePct') ? Number(formData.get('complianceFilingsOnTimePct')) : undefined,
      },
      notes: (formData.get('notes') as string) || undefined,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <Masthead title="ESG report" subtitle="Quarterly environmental, social, governance snapshot" />

      <Card>
        <CardHeader>
          <CardTitle>New snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={snapshotAction} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="hidden" name="entityId" value={entityId} />
            <label className="text-sm">
              Snapshot date
              <input required type="date" name="snapshotDate" defaultValue={todayIso()} className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Period start
              <input required type="date" name="periodStart" className="block w-full border rounded p-2 text-sm" />
            </label>
            <label className="text-sm">
              Period end
              <input required type="date" name="periodEnd" className="block w-full border rounded p-2 text-sm" />
            </label>

            <label className="text-sm md:col-span-3 font-semibold border-t pt-2">Environmental</label>
            <label className="text-sm">Net CO2e (tons) <input type="number" step="0.01" name="netCo2eTons" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Water used (m3) <input type="number" step="1" name="waterUsedM3" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Water saved (m3) <input type="number" step="1" name="waterSavedM3" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Renewable energy (kWh) <input type="number" step="1" name="renewableEnergyKwh" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Synthetic fertilizer (kg) <input type="number" step="1" name="syntheticFertilizerKg" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Pesticide (kg) <input type="number" step="1" name="pesticideKg" className="block w-full border rounded p-2 text-sm" /></label>

            <label className="text-sm md:col-span-3 font-semibold border-t pt-2">Social</label>
            <label className="text-sm">Headcount <input required type="number" step="1" name="headcount" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Female % <input type="number" step="0.1" name="femaleHeadcountPct" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Safety incidents <input type="number" step="1" name="safetyIncidents" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Training hours <input type="number" step="1" name="trainingHours" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Avg wage (PKR) <input type="number" step="1" name="avgWagePkr" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Community investment (PKR) <input type="number" step="1" name="communityInvestmentPkr" className="block w-full border rounded p-2 text-sm" /></label>

            <label className="text-sm md:col-span-3 font-semibold border-t pt-2">Governance</label>
            <label className="text-sm">Board meetings <input type="number" step="1" name="boardMeetingsHeld" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Approvals recorded <input type="number" step="1" name="approvalsRecorded" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Grievances resolved % <input type="number" step="0.1" name="grievancesResolvedPct" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm">Compliance on-time % <input type="number" step="0.1" name="complianceFilingsOnTimePct" className="block w-full border rounded p-2 text-sm" /></label>
            <label className="text-sm flex items-center gap-2 mt-6">
              <input type="checkbox" name="auditCompleted" /> Audit completed
            </label>

            <label className="text-sm">
              Framework
              <input name="framework" defaultValue="GRI-aligned" className="block w-full border rounded p-2 text-sm" />
            </label>

            <label className="text-sm md:col-span-3">
              Notes
              <textarea name="notes" rows={2} className="block w-full border rounded p-2 text-sm" />
            </label>
            <div className="md:col-span-3">
              <button type="submit" className="rounded bg-emerald-700 text-white px-3 py-2 text-sm">
                Save snapshot
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No snapshots" description="Capture your first ESG snapshot above." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="border rounded p-3 text-sm">
                  <div className="font-semibold">
                    {r.snapshotDate} <span className="text-xs text-zinc-500">({r.framework})</span>
                  </div>
                  <div className="text-xs text-zinc-500">Period: {r.periodStart} to {r.periodEnd}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <div>
                      <div className="text-xs uppercase text-zinc-500">Environmental</div>
                      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.environmental, null, 2)}</pre>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-zinc-500">Social</div>
                      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.social, null, 2)}</pre>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-zinc-500">Governance</div>
                      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(r.governance, null, 2)}</pre>
                    </div>
                  </div>
                  <div className="mt-2">
                    <a className="text-xs underline" href={`/api/sustainability/esg-export?snapshotId=${r.id}&format=xlsx`}>Export XLSX</a>
                    <span className="mx-2 text-zinc-400">·</span>
                    <a className="text-xs underline" href={`/api/sustainability/esg-export?snapshotId=${r.id}&format=pdf`}>Export PDF</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
