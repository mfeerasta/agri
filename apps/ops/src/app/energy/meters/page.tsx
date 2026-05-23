import { desc, eq } from 'drizzle-orm';
import { db, energyMeters, energyReadings } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, EmptyState } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { MeterForm } from './meter-form';
import { ReadingForm } from './reading-form';

export const dynamic = 'force-dynamic';

export default async function MetersPage() {
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) {
    return <EmptyState title="No entity" description="Sign in." />;
  }
  const meters = await db
    .select()
    .from(energyMeters)
    .where(eq(energyMeters.entityId, entityId))
    .orderBy(desc(energyMeters.createdAt));

  const recent = meters.length
    ? await db
        .select()
        .from(energyReadings)
        .where(eq(energyReadings.meterId, meters[0]!.id))
        .orderBy(desc(energyReadings.readingDate))
        .limit(20)
    : [];

  return (
    <div className="p-6 space-y-6">
      <Masthead title="Energy meters" subtitle="Inventory and monthly reading entry" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Register new meter</CardTitle>
          </CardHeader>
          <CardContent>
            <MeterForm entityId={entityId} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Record reading</CardTitle>
          </CardHeader>
          <CardContent>
            {meters.length === 0 ? (
              <div className="text-sm text-zinc-500">Register a meter first.</div>
            ) : (
              <ReadingForm meters={meters.map((m) => ({ id: m.id, label: `${m.meterNumber} (${m.meterKind})` }))} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meters ({meters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {meters.length === 0 ? (
            <div className="text-sm text-zinc-500">No meters yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1">Number</th>
                  <th>Kind</th>
                  <th>Connection</th>
                  <th>Capacity kW</th>
                  <th>Tariff (PKR/kWh)</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-1">{m.meterNumber}</td>
                    <td>{m.meterKind}</td>
                    <td>{m.connectionKind ?? '-'}</td>
                    <td>{m.capacityKw ?? '-'}</td>
                    <td>{m.tariffPkrPerKwh ?? '-'}</td>
                    <td>{m.isActive ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent readings (top meter)</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1">Date</th>
                  <th>Period</th>
                  <th>kWh consumed</th>
                  <th>kWh generated</th>
                  <th>Cost PKR</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-1">{r.readingDate}</td>
                    <td>{r.readingTime}</td>
                    <td>{r.consumptionKwh ?? '-'}</td>
                    <td>{r.generationKwh ?? '-'}</td>
                    <td>{r.costPkr ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
