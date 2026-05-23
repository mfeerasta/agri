import { eq, inArray } from 'drizzle-orm';
import { db, warabandiSlots, waterSources, farms } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { WarabandiCalendarClient } from '@/modules/irrigation/warabandi-calendar-client';

export const dynamic = 'force-dynamic';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Stable color palette for sources (cycled by index)
const SOURCE_PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#be185d',
];

export default async function WarabandiPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const farmRows = await db.select({ id: farms.id, name: farms.name }).from(farms).where(eq(farms.entityId, ctx.entityId));
  const farmIds = farmRows.map((f) => f.id);

  const sources = farmIds.length
    ? await db.select({
        id: waterSources.id,
        kind: waterSources.kind,
        identifier: waterSources.identifier,
        farmId: waterSources.farmId,
      }).from(waterSources).where(inArray(waterSources.farmId, farmIds))
    : [];

  const sourceIds = sources.map((s) => s.id);
  const slots = sourceIds.length
    ? await db.select().from(warabandiSlots).where(inArray(warabandiSlots.waterSourceId, sourceIds))
    : [];

  const sourcesWithColor = sources.map((s, i) => ({
    ...s,
    color: SOURCE_PALETTE[i % SOURCE_PALETTE.length]!,
    farmName: farmRows.find((f) => f.id === s.farmId)?.name ?? '-',
  }));

  return (
    <div>
      <Masthead section="WARABANDI ROTATIONS" />
      <SectionDivider />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Water sources</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {sourcesWithColor.length === 0 ? (
            <div className="text-sm text-[var(--ink)]/50">No water sources configured.</div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
              {sourcesWithColor.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded border border-[var(--rule)] p-2">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
                  <span className="font-medium">{s.identifier ?? s.kind}</span>
                  <span className="text-[var(--ink)]/50">({s.kind}) {s.farmName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly slot grid</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <WarabandiCalendarClient
            days={DAYS}
            sources={sourcesWithColor}
            slots={slots.map((s) => ({
              id: s.id,
              waterSourceId: s.waterSourceId,
              dayOfWeek: s.dayOfWeek,
              startTime: String(s.startTime),
              endTime: String(s.endTime),
              durationMinutes: s.durationMinutes ?? 0,
              rotationWeeks: s.rotationWeeks,
              isActive: s.isActive,
              notes: s.notes ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
