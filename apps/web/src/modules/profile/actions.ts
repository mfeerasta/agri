'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db, users } from '@zameen/db';
import { eq } from 'drizzle-orm';
import type { Locale } from '@zameen/locale';
import { getSessionContext } from '@/lib/session';

const SUPPORTED: ReadonlySet<Locale> = new Set(['ur', 'roman_ur', 'en']);

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
