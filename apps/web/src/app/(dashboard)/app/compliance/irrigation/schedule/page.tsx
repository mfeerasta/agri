import { eq, inArray, and, gte, lte } from 'drizzle-orm';
import {
  db,
  warabandiSlots,
  waterSources,
  farms,
  blocks,
  fields,
  irrigationSchedules,
} from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { ScheduleBoardClient } from '@/modules/irrigation/schedule-board-client';

export const dynamic = 'force-dynamic';

export default async function SchedulePlannerPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const farmRows = await db.select({ id: farms.id }).from(farms).where(eq(farms.entityId, ctx.entityId));
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
    ? await db.select().from(warabandiSlots)
        .where(and(inArray(warabandiSlots.waterSourceId, sourceIds), eq(warabandiSlots.isActive, true)))
    : [];

  // All fields under this entity
  const fieldRows = farmIds.length
    ? await db.select({
        id: fields.id,
        code: fields.code,
        name: fields.name,
        acres: fields.acres,
      })
      .from(fields)
      .innerJoin(blocks, eq(blocks.id, fields.blockId))
      .where(inArray(blocks.farmId, farmIds))
    : [];

  // Existing schedules within the next 14 days
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const schedules = fieldRows.length
    ? await db.select().from(irrigationSchedules).where(and(
        inArray(irrigationSchedules.fieldId, fieldRows.map((f) => f.id)),
        gte(irrigationSchedules.scheduledFor, now),
        lte(irrigationSchedules.scheduledFor, horizon),
      ))
    : [];

  return (
    <div>
      <Masthead section="IRRIGATION SCHEDULE" />
      <SectionDivider />

      <Card>
        <CardHeader>
          <CardTitle>Drag a field onto a Warabandi slot</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScheduleBoardClient
            fields={fieldRows.map((f) => ({
              id: f.id,
              label: `${f.code}${f.name ? ' / ' + f.name : ''}`,
              acres: Number(f.acres ?? 0),
            }))}
            sources={sources}
            slots={slots.map((s) => ({
              id: s.id,
              waterSourceId: s.waterSourceId,
              dayOfWeek: s.dayOfWeek,
              startTime: String(s.startTime).slice(0, 5),
              endTime: String(s.endTime).slice(0, 5),
              durationMinutes: s.durationMinutes ?? 0,
            }))}
            schedules={schedules.map((s) => ({
              id: s.id,
              fieldId: s.fieldId,
              scheduledFor: s.scheduledFor.toISOString(),
              warabandiSlotId: s.warabandiSlotId,
              status: s.status,
              expectedDurationMinutes: s.expectedDurationMinutes,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
