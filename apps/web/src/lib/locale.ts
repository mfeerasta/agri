'use server';

import { cookies } from 'next/headers';
import { db, users } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { WEB_DEFAULT_LOCALE, type Locale } from '@zameen/locale';
import { getSessionContext } from './session';

const SUPPORTED: ReadonlySet<Locale> = new Set(['ur', 'roman_ur', 'en']);

function coerce(v: string | undefined | null): Locale | null {
  if (!v) return null;
  return SUPPORTED.has(v as Locale) ? (v as Locale) : null;
}

export async function getLocale(): Promise<Locale> {
  const session = await getSessionContext();
  if (session?.userId) {
    try {
      const [row] = await db
        .select({ pref: users.preferredLocale })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      const pref = coerce(row?.pref);
      if (pref) return pref;
    } catch {
      // fall through
    }
  }
  const c = await cookies();
  const cookieLocale = coerce(c.get('zameenLocale')?.value);
  if (cookieLocale) return cookieLocale;
  return WEB_DEFAULT_LOCALE;
}
