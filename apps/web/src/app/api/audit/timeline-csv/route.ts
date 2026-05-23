import { NextResponse } from 'next/server';
import { db, auditLog, users } from '@zameen/db';
import { and, desc, eq } from 'drizzle-orm';
import { logger, traceIdFromRequest, setTraceId } from '@zameen/shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Export the audit timeline for a single (resource, id) pair as CSV.
 * Linked from the timeline component header.
 */
export async function GET(req: Request): Promise<Response> {
  const traceId = traceIdFromRequest(req);
  setTraceId(traceId);

  const url = new URL(req.url);
  const resource = url.searchParams.get('resource');
  const resourceId = url.searchParams.get('id');
  if (!resource || !resourceId) {
    return NextResponse.json({ error: 'resource and id are required' }, { status: 400 });
  }

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      occurredAt: auditLog.occurredAt,
      actorRole: auditLog.actorRole,
      actorName: users.fullName,
      before: auditLog.before,
      after: auditLog.after,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(and(eq(auditLog.resource, resource), eq(auditLog.resourceId, resourceId)))
    .orderBy(desc(auditLog.occurredAt));

  logger.info('audit-timeline-csv', 'exported', { traceId, resource, resourceId, rowCount: rows.length });

  const header = ['occurred_at', 'actor', 'actor_role', 'action', 'resource', 'resource_id', 'before', 'after'];
  const body = rows.map((r) =>
    [
      new Date(r.occurredAt).toISOString(),
      r.actorName,
      r.actorRole,
      r.action,
      r.resource,
      r.resourceId,
      r.before,
      r.after,
    ]
      .map(csvCell)
      .join(','),
  );

  const csv = [header.join(','), ...body].join('\n');
  const filename = `audit-${resource}-${resourceId}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
      'x-request-id': traceId,
    },
  });
}
