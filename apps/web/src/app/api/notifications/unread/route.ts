/**
 * GET /api/notifications/unread
 * Returns the count of unread in-app notifications for the current user.
 * Used by the dashboard header bell badge.
 */

import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db, notifications } from '@zameen/db';
import { getSessionContext } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, session.userId),
        eq(notifications.channel, 'in_app'),
        isNull(notifications.readAt),
      ),
    );

  return NextResponse.json({ count: rows.length });
}
