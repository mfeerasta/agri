'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, calendarSubscriptionTokens, type CalendarTokenScope } from '@zameen/db';
import { getSessionContext } from '@/lib/session';

const VALID_SCOPES: ReadonlySet<CalendarTokenScope> = new Set([
  'tasks',
  'crop_plans',
  'approvals',
  'feasibilities',
  'all',
]);

export interface CreateTokenInput {
  scope: CalendarTokenScope;
  expiresInDays?: number;
}

export async function listMyCalendarTokens() {
  const session = await getSessionContext();
  if (!session) return [];
  return db
    .select()
    .from(calendarSubscriptionTokens)
    .where(eq(calendarSubscriptionTokens.userId, session.userId));
}

export async function createCalendarToken(input: CreateTokenInput): Promise<{ ok: boolean; token?: string; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: 'unauthorized' };
  if (!VALID_SCOPES.has(input.scope)) return { ok: false, error: 'invalid scope' };

  const token = randomBytes(24).toString('base64url');
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  await db.insert(calendarSubscriptionTokens).values({
    userId: session.userId,
    token,
    scope: input.scope,
    expiresAt,
  });

  revalidatePath('/admin/profile/calendars');
  return { ok: true, token };
}

export async function revokeCalendarToken(id: string): Promise<{ ok: boolean }> {
  const session = await getSessionContext();
  if (!session) return { ok: false };
  await db
    .delete(calendarSubscriptionTokens)
    .where(and(eq(calendarSubscriptionTokens.id, id), eq(calendarSubscriptionTokens.userId, session.userId)));
  revalidatePath('/admin/profile/calendars');
  return { ok: true };
}
