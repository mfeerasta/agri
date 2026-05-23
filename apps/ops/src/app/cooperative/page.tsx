import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import {
  db,
  cooperatives,
  cooperativeMembers,
  groupBuyingPools,
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

export default async function CooperativeHome() {
  const coops = await db.select().from(cooperatives).where(eq(cooperatives.isActive, true)).limit(20);
  const [{ memberCount }] = (await db
    .select({ memberCount: sql<number>`count(*)::int` })
    .from(cooperativeMembers)
    .where(eq(cooperativeMembers.membershipStatus, 'active'))) as Array<{ memberCount: number }>;
  const [{ poolCount }] = (await db
    .select({ poolCount: sql<number>`count(*)::int` })
    .from(groupBuyingPools)
    .where(eq(groupBuyingPools.status, 'open'))) as Array<{ poolCount: number }>;
  const [{ arrCount }] = (await db
    .select({ arrCount: sql<number>`count(*)::int` })
    .from(equipmentSharingArrangements)
    .where(eq(equipmentSharingArrangements.isActive, true))) as Array<{ arrCount: number }>;
  const [{ savings }] = (await db
    .select({
      savings: sql<number>`coalesce(sum(${equipmentRentals.totalChargePkr}),0)::numeric`,
    })
    .from(equipmentRentals)
    .where(eq(equipmentRentals.status, 'completed'))) as Array<{ savings: number }>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead section="Cooperative and farmer network" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatBlock label="Active members" value={memberCount ?? 0} caption="cooperative roster" />
        <StatBlock label="Open pools" value={poolCount ?? 0} caption="group buying" />
        <StatBlock label="Shared assets" value={arrCount ?? 0} caption="equipment arrangements" />
        <StatBlock
          label="Rental revenue"
          value={<Pkr value={Number(savings ?? 0)} />}
          caption="completed rentals"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={'/cooperative/members' as never}
          className="smallcaps rounded-sm bg-[var(--zameen-700)] px-3 py-2 text-[var(--paper)]"
        >
          Members
        </Link>
        <Link
          href={'/cooperative/group-buying' as never}
          className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2"
        >
          Group buying
        </Link>
        <Link
          href={'/cooperative/equipment-sharing' as never}
          className="smallcaps rounded-sm bg-[var(--paper-2)] px-3 py-2"
        >
          Equipment sharing
        </Link>
      </div>

      <SectionDivider label="Registered cooperatives" />
      <div className="grid gap-4 md:grid-cols-2">
        {coops.length === 0 && (
          <p className="text-xs text-[var(--zameen-600)]">No cooperative registered yet.</p>
        )}
        {coops.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {c.nameUr && <div className="text-[var(--zameen-700)]">{c.nameUr}</div>}
              {c.registrationNumber && (
                <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">
                  Reg {c.registrationNumber} ({c.authority ?? 'authority'})
                </div>
              )}
              {c.defaultMeetingDay && (
                <div className="text-xs">Meeting: {c.defaultMeetingDay}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
