import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import {
  db,
  assets,
  equipmentSharingArrangements,
  equipmentRentals,
} from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  Pkr,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function EquipmentSharingPage() {
  const rows = await db
    .select({
      id: equipmentSharingArrangements.id,
      assetId: equipmentSharingArrangements.assetId,
      ratePerHourPkr: equipmentSharingArrangements.ratePerHourPkr,
      ratePerAcrePkr: equipmentSharingArrangements.ratePerAcrePkr,
      ratePerDayPkr: equipmentSharingArrangements.ratePerDayPkr,
      fuelArrangement: equipmentSharingArrangements.fuelArrangement,
      operatorProvided: equipmentSharingArrangements.operatorProvided,
      isActive: equipmentSharingArrangements.isActive,
      assetCode: assets.code,
      assetMake: assets.make,
      assetModel: assets.model,
    })
    .from(equipmentSharingArrangements)
    .leftJoin(assets, eq(assets.id, equipmentSharingArrangements.assetId))
    .orderBy(desc(equipmentSharingArrangements.createdAt))
    .limit(50);

  const utilByArr = await db
    .select({
      arrangementId: equipmentRentals.arrangementId,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      hours: sql<number>`coalesce(sum(${equipmentRentals.hoursUsed}),0)::numeric`,
      revenue: sql<number>`coalesce(sum(${equipmentRentals.totalChargePkr}),0)::numeric`,
    })
    .from(equipmentRentals)
    .groupBy(equipmentRentals.arrangementId);
  const utilMap = new Map(utilByArr.map((r) => [r.arrangementId, r]));

  const totalRevenue = utilByArr.reduce((acc, r) => acc + Number(r.revenue ?? 0), 0);
  const totalHours = utilByArr.reduce((acc, r) => acc + Number(r.hours ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Equipment sharing" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatBlock label="Arrangements" value={rows.length} caption="active and inactive" />
        <StatBlock label="Hours rented" value={Number(totalHours).toFixed(1)} caption="across fleet" />
        <StatBlock
          label="Revenue"
          value={<Pkr value={totalRevenue} />}
          caption="completed rentals"
        />
      </div>

      <SectionDivider label="Shared equipment" />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.length === 0 && (
          <p className="text-xs text-[var(--zameen-600)]">No sharing arrangements yet.</p>
        )}
        {rows.map((r) => {
          const u = utilMap.get(r.id);
          return (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {r.assetCode} {r.assetMake} {r.assetModel}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">
                  {r.isActive ? 'active' : 'paused'} | fuel: {r.fuelArrangement ?? 'n/a'} | operator:{' '}
                  {r.operatorProvided ? 'yes' : 'no'}
                </div>
                <div className="tabular text-xs">
                  {r.ratePerHourPkr && (
                    <span>
                      <Pkr value={Number(r.ratePerHourPkr)} /> /hr
                    </span>
                  )}
                  {r.ratePerAcrePkr && (
                    <span className="ml-2">
                      <Pkr value={Number(r.ratePerAcrePkr)} /> /acre
                    </span>
                  )}
                  {r.ratePerDayPkr && (
                    <span className="ml-2">
                      <Pkr value={Number(r.ratePerDayPkr)} /> /day
                    </span>
                  )}
                </div>
                {u && (
                  <div className="text-xs">
                    {u.completed} rentals | {Number(u.hours).toFixed(1)} hrs |{' '}
                    <Pkr value={Number(u.revenue)} />
                  </div>
                )}
                <Link
                  href={`/cooperative/equipment-sharing/${r.id}/rentals` as never}
                  className="smallcaps inline-block rounded-sm bg-[var(--paper-2)] px-2 py-1 text-xs"
                >
                  Booking calendar
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
