import { desc } from 'drizzle-orm';
import { db, cooperatives, cooperativeMembers } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  SectionDivider,
} from '@zameen/ui';
import { MemberForm } from './member-form';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const coops = await db.select().from(cooperatives).limit(50);
  const members = await db
    .select()
    .from(cooperativeMembers)
    .orderBy(desc(cooperativeMembers.createdAt))
    .limit(200);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Masthead section="Cooperative members" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onboard new member</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberForm cooperatives={coops.map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>

      <SectionDivider label="Roster" />
      <div className="grid gap-3 md:grid-cols-2">
        {members.length === 0 && (
          <p className="text-xs text-[var(--zameen-600)]">No members yet.</p>
        )}
        {members.map((m) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle className="text-base">{m.memberName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="smallcaps text-[0.65rem] text-[var(--zameen-600)]">
                {m.village ?? 'village unknown'} {m.membershipStatus !== 'active' ? `(${m.membershipStatus})` : ''}
              </div>
              {m.phone && <div className="tabular text-xs">{m.phone}</div>}
              <div className="text-xs">
                Acres: {m.totalAcres ?? '0'} | Shares: {m.sharesHeld}
              </div>
              {m.cropsGrown && m.cropsGrown.length > 0 && (
                <div className="text-xs text-[var(--zameen-700)]">
                  {m.cropsGrown.join(', ')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
