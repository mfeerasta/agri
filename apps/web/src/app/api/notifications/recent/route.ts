/**
 * GET /api/notifications/recent
 * Returns the 10 most recent unread in-app notifications for the current
 * user. Powers the bell dropdown.
 */

import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, notifications } from '@zameen/db';
import { getSessionContext } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      bodyUr: notifications.bodyUr,
      deepLink: notifications.deepLink,
      createdAt: notifications.createdAt,
      category: notifications.category,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, session.userId),
        eq(notifications.channel, 'in_app'),
        isNull(notifications.readAt),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  return NextResponse.json({ items: rows });
}
