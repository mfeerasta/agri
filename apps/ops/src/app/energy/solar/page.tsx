import { desc, eq, sql, and, gte } from 'drizzle-orm';
import { db, solarSystems, energyMeters, energyReadings } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { SolarForm } from './solar-form';

export const dynamic = 'force-dynamic';

export default async function SolarPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) return <EmptyState title="No entity" description="Sign in." />;

  const systems = await db
    .select()
    .from(solarSystems)
    .where(eq(solarSystems.entityId, entityId))
    .orderBy(desc(solarSystems.commissionedOn));

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoIso = yearAgo.toISOString().slice(0, 10);

  const [solarGen] = await db
    .select({
      kwh: sql<number>`coalesce(sum(${energyReadings.generationKwh}::numeric), 0)`,
    })
    .from(energyReadings)
    .innerJoin(energyMeters, eq(energyReadings.meterId, energyMeters.id))
    .where(
      and(
        eq(energyMeters.entityId, entityId),
        eq(energyMeters.meterKind, 'solar_inverter'),
        gte(energyReadings.readingDate, yearAgoIso),
      ),
    );

  const actualKwh = Number(solarGen?.kwh ?? 0);

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Solar systems" subtitle="Installation tracking, generation vs estimate, ROI" />

      <Card>
        <CardHeader>
          <CardTitle>Register installation</CardTitle>
        </CardHeader>
        <CardContent>
          <SolarForm entityId={entityId} />
        </CardContent>
      </Card>

      {systems.length === 0 ? (
        <EmptyState title="No solar systems yet" description="Register your first installation above." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systems.map((s) => {
            const estAnnual = Number(s.estimatedAnnualGenerationKwh ?? 0);
            const ratio = estAnnual > 0 ? (actualKwh / estAnnual) * 100 : null;
            const costPkr = Number(s.costPkr ?? 0);
            const annualSavingsPkr = actualKwh * 35; // assume 35 PKR/kWh avoided grid cost
            const paybackYears = annualSavingsPkr > 0 ? costPkr / annualSavingsPkr : null;

            return (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle>{s.installationName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>
                    {s.panelsCount} panels - {Number(s.totalCapacityKw).toFixed(2)} kW
                  </div>
                  <div>
                    Commissioned: {s.commissionedOn}
                    {s.warrantyUntil && <span className="text-zinc-500"> (warranty {s.warrantyUntil})</span>}
                  </div>
                  {s.inverterModel && <div>Inverter: {s.inverterModel}</div>}
                  {s.batteryCapacityKwh && <div>Battery: {s.batteryCapacityKwh} kWh</div>}
                  <div>
                    Cost: <Pkr value={Math.round(costPkr * 100)} />
                    {s.costPerKwPkr && <span className="text-zinc-500"> ({s.costPerKwPkr}/kW)</span>}
                  </div>
                  <div>Net metering: {s.netMeteringApproved ? 'Approved' : 'Pending'}</div>
                  <div className="pt-2 border-t">
                    <div>Estimated annual: {estAnnual.toFixed(0)} kWh</div>
                    <div>Actual (last 12mo): {actualKwh.toFixed(0)} kWh</div>
                    {ratio != null && (
                      <div className={ratio < 80 ? 'text-red-600' : 'text-emerald-700'}>
                        Performance: {ratio.toFixed(1)}% of estimate
                      </div>
                    )}
                    {paybackYears != null && (
                      <div>ROI payback: {paybackYears.toFixed(1)} years (at PKR 35/kWh)</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
