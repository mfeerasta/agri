'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db, users } from '@zameen/db';
import { eq } from 'drizzle-orm';
import type { Locale } from '@zameen/locale';
import { getSessionContext } from '@/lib/session';

const SUPPORTED: ReadonlySet<Locale> = new Set(['ur', 'roman_ur', 'pa', 'hi', 'en']);

export async function updateMyLocale(locale: Locale): Promise<{ ok: boolean }> {
  if (!SUPPORTED.has(locale)) return { ok: false };
  const c = await cookies();
  c.set('zameenLocale', locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  const session = await getSessionContext();
  if (session?.userId) {
    try {
      await db
        .update(users)
        .set({ preferredLocale: locale })
        .where(eq(users.id, session.userId));
    } catch {
      // best-effort; cookie remains the source of truth this session
    }
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

async function appendTourState(field: 'toursCompleted' | 'toursSkipped', tourId: string): Promise<{ ok: boolean }> {
  const session = await getSessionContext();
  if (!session?.userId) return { ok: false };
  const [row] = await db
    .select({ completed: users.toursCompleted, skipped: users.toursSkipped })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!row) return { ok: false };
  const current = (field === 'toursCompleted' ? row.completed : row.skipped) ?? [];
  if (current.includes(tourId)) return { ok: true };
  const next = [...current, tourId];
  await db
    .update(users)
    .set({ [field]: next })
    .where(eq(users.id, session.userId));
  return { ok: true };
}

export async function markTourComplete(tourId: string): Promise<{ ok: boolean }> {
  return appendTourState('toursCompleted', tourId);
}

export async function skipTour(tourId: string): Promise<{ ok: boolean }> {
  return appendTourState('toursSkipped', tourId);
}

export async function resetTours(): Promise<{ ok: boolean }> {
  const session = await getSessionContext();
  if (!session?.userId) return { ok: false };
  await db
    .update(users)
    .set({ toursCompleted: [], toursSkipped: [] })
    .where(eq(users.id, session.userId));
  revalidatePath('/', 'layout');
  return { ok: true };
}
