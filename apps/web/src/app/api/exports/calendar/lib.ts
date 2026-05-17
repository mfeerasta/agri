import { db, calendarSubscriptionTokens } from '@zameen/db';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/session';

export type CalendarScope = 'tasks' | 'crop_plans' | 'approvals' | 'feasibilities' | 'all';

export interface CalendarAuthContext {
  userId: string;
  entityId: string;
  scope: CalendarScope | 'session';
}

export async function authCalendarRequest(
  req: NextRequest,
  requiredScope: CalendarScope,
): Promise<CalendarAuthContext | { error: string; status: number }> {
  const url = new URL(req.url);
  const live = url.searchParams.get('live') === 'true';
  const token = url.searchParams.get('token');

  if (live && token) {
    const now = new Date();
    const [row] = await db
      .select()
      .from(calendarSubscriptionTokens)
      .where(
        and(
          eq(calendarSubscriptionTokens.token, token),
          or(isNull(calendarSubscriptionTokens.expiresAt), gt(calendarSubscriptionTokens.expiresAt, now)),
        ),
      )
      .limit(1);
    if (!row) return { error: 'Invalid or expired token', status: 401 };
    if (row.scope !== 'all' && row.scope !== requiredScope) {
      return { error: 'Token scope mismatch', status: 403 };
    }
    // best-effort update
    try {
      await db
        .update(calendarSubscriptionTokens)
        .set({ lastAccessedAt: now })
        .where(eq(calendarSubscriptionTokens.id, row.id));
    } catch {
      // ignore
    }
    // Resolve user entity
    const userRow = await db.execute(
      sql`select default_entity_id from zameen.users where id = ${row.userId} limit 1`,
    );
    const entityId =
      ((userRow as unknown as { rows?: Array<{ default_entity_id: string }> }).rows?.[0]?.default_entity_id) ?? '';
    return { userId: row.userId, entityId, scope: row.scope as CalendarScope };
  }

  const session = await getSessionContext();
  if (!session) return { error: 'Unauthorized', status: 401 };
  return { userId: session.userId, entityId: session.entityId, scope: 'session' };
}

export function parseDateRange(req: NextRequest, defaultDays: number = 90): { from: Date; to: Date } {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const defaultTo = new Date(now.getTime() + defaultDays * 24 * 60 * 60 * 1000);
  const from = fromStr ? new Date(fromStr) : defaultFrom;
  const to = toStr ? new Date(toStr) : defaultTo;
  return { from, to };
}
