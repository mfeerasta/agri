/**
 * Audit logging helper. Writes one row per sensitive action into
 * zameen.audit_log. Intentionally lossy on failure (we never break the
 * write path because of an audit error) but logs to stderr so ops can
 * pick it up via Loki.
 */

import { db, auditLog } from '@zameen/db';

interface AuditOptions {
  actorId: string;
  entityId?: string | null;
  actorRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  request?: Request;
  gps?: { lat: number; lng: number; accuracy?: number } | null;
}

function ipFrom(req: Request | undefined): string | null {
  if (!req) return null;
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip');
}

export async function audit(options: AuditOptions): Promise<void> {
  try {
    await db.insert(auditLog).values({
      entityId: options.entityId ?? null,
      actorId: options.actorId,
      actorRole: options.actorRole ?? null,
      action: options.action,
      resource: options.resource,
      resourceId: options.resourceId ?? null,
      before: (options.before as object) ?? null,
      after: (options.after as object) ?? null,
      ipAddress: ipFrom(options.request),
      userAgent: options.request?.headers.get('user-agent') ?? null,
      gpsLocation: (options.gps as object) ?? null,
    });
  } catch (error) {
    console.error('[audit] failed to write entry', {
      action: options.action,
      resource: options.resource,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
