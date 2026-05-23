import { db, liveActivity } from '@zameen/db';
import { and, desc, eq } from 'drizzle-orm';
import type { LiveActivityItem } from './components/live-activity-feed';

export async function getRecentLiveActivity(
  entityId: string,
  opts: { fieldId?: string; limit?: number } = {},
): Promise<LiveActivityItem[]> {
  const limit = opts.limit ?? 50;
  const where = opts.fieldId
    ? and(eq(liveActivity.entityId, entityId), eq(liveActivity.fieldId, opts.fieldId))
    : eq(liveActivity.entityId, entityId);

  const rows = await db
    .select()
    .from(liveActivity)
    .where(where)
    .orderBy(desc(liveActivity.occurredAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    entityId: r.entityId,
    occurredAt: r.occurredAt.toISOString(),
    activityKind: r.activityKind,
    resourceKind: r.resourceKind,
    resourceId: r.resourceId,
    fieldId: r.fieldId,
    summary: r.summary,
    summaryUr: r.summaryUr,
    severity: (r.severity as LiveActivityItem['severity']) ?? 'info',
    actorName: r.actorName,
  }));
}
