/**
 * POST /api/notifications/[id]/read
 * Marks a single notification as read, scoped to the current user.
 */

import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, notifications } from '@zameen/db';
import { getSessionContext } from '../../../../../lib/session';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, session.userId)));

  return NextResponse.json({ ok: true });
}
