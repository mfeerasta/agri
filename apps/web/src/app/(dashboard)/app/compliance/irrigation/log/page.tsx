import { desc, eq, inArray } from 'drizzle-orm';
import {
  db,
  blocks,
  farms,
  fields,
  irrigationEvents,
  waterSources,
} from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { IrrigationLogForm } from '@/modules/irrigation/irrigation-log-form';

export const dynamic = 'force-dynamic';

export default async function IrrigationLogPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;

  const farmRows = await db.select({ id: farms.id }).from(farms).where(eq(farms.entityId, ctx.entityId));
  const farmIds = farmRows.map((f) => f.id);

  const fieldRows = farmIds.length
    ? await db.select({ id: fields.id, code: fields.code, name: fields.name })
        .from(fields)
        .innerJoin(blocks, eq(blocks.id, fields.blockId))
        .where(inArray(blocks.farmId, farmIds))
    : [];

  const sourceRows = farmIds.length
    ? await db.select({ id: waterSources.id, kind: waterSources.kind, identifier: waterSources.identifier })
        .from(waterSources)
        .where(inArray(waterSources.farmId, farmIds))
    : [];

  const recentEvents = fieldRows.length
    ? await db.select().from(irrigationEvents)
        .where(inArray(irrigationEvents.fieldId, fieldRows.map((f) => f.id)))
        .orderBy(desc(irrigationEvents.startedAt))
        .limit(20)
    : [];

  return (
    <div>
      <Masthead section="LOG IRRIGATION EVENT" />
      <SectionDivider />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>New event</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <IrrigationLogForm
            fields={fieldRows.map((f) => ({ id: f.id, label: `${f.code}${f.name ? ' / ' + f.name : ''}` }))}
            sources={sourceRows.map((s) => ({ id: s.id, label: `${s.identifier ?? s.kind} (${s.kind})`, kind: s.kind }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentEvents.length === 0 ? (
            <div className="p-4 text-sm text-[var(--ink)]/50">No events logged yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left">
                  <th className="p-2">Started</th>
                  <th className="p-2">Field</th>
                  <th className="p-2">Method</th>
                  <th className="tabular p-2">Duration (min)</th>
                  <th className="tabular p-2">Volume (m³)</th>
                  <th className="tabular p-2">Cost PKR</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--rule)]">
                    <td className="p-2">{new Date(e.startedAt).toLocaleString()}</td>
                    <td className="p-2">{fieldRows.find((f) => f.id === e.fieldId)?.code ?? '-'}</td>
                    <td className="p-2">{e.method ?? '-'}</td>
                    <td className="tabular p-2">{e.durationMinutes ?? '-'}</td>
                    <td className="tabular p-2">{e.estimatedVolumeM3 ?? '-'}</td>
                    <td className="tabular p-2">{e.costPkr ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
