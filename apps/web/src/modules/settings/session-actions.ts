'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { db, userSessions } from '@zameen/db';
import { getSessionContext } from '../../lib/session';

export interface SessionRow {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  ipAddressMasked: string | null;
  app: string;
  city: string | null;
  country: string | null;
  signedInAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
  isPasskey: boolean;
  passkeyDeviceName?: string | null;
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 2).join(':')}:****:****`;
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return '****';
  return `${parts[0]}.${parts[1]}.*.*`;
}

function parseUaForPasskey(ua: string | null): { isPasskey: boolean; deviceName: string | null } {
  if (!ua) return { isPasskey: false, deviceName: null };
  const isPasskey = /webauthn|passkey/i.test(ua);
  let deviceName: string | null = null;
  const m = ua.match(/passkey:([^;]+)/i);
  if (m && m[1]) deviceName = m[1].trim();
  return { isPasskey, deviceName };
}

async function getCurrentSessionTokenHash(): Promise<string | null> {
  // The current session token hash is set on the session row by the auth
  // layer. We look up by user + latest last_active_at as a fallback.
  return null;
}

export async function listSessions(): Promise<SessionRow[]> {
  const session = await getSessionContext();
  if (!session) return [];

  const rows = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, session.userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastActiveAt));

  const currentHash = await getCurrentSessionTokenHash();
  const currentFallbackId = rows[0]?.id ?? null;

  return rows.map((r, idx) => {
    const passkey = parseUaForPasskey(r.userAgent);
    const isCurrentByHash = currentHash !== null && r.sessionTokenHash === currentHash;
    const isCurrentByFallback = currentHash === null && idx === 0 && r.id === currentFallbackId;
    return {
      id: r.id,
      deviceLabel: r.deviceLabel,
      userAgent: r.userAgent,
      ipAddressMasked: maskIp(r.ipAddress),
      app: r.app,
      city: r.city,
      country: r.country,
      signedInAt: r.signedInAt.toISOString(),
      lastActiveAt: r.lastActiveAt.toISOString(),
      isCurrent: isCurrentByHash || isCurrentByFallback,
      isPasskey: passkey.isPasskey,
      passkeyDeviceName: passkey.deviceName,
    };
  });
}

export async function revokeSession(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: 'unauthorized' };

  const result = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.id, id),
        eq(userSessions.userId, session.userId),
        isNull(userSessions.revokedAt),
      ),
    )
    .returning({ id: userSessions.id });

  if (result.length === 0) return { ok: false, error: 'not_found' };

  revalidatePath('/app/settings/sessions');
  return { ok: true };
}

export async function revokeOtherSessions(): Promise<{ ok: boolean; revoked: number }> {
  const session = await getSessionContext();
  if (!session) return { ok: false, revoked: 0 };

  const sessions = await db
    .select({ id: userSessions.id, lastActiveAt: userSessions.lastActiveAt })
    .from(userSessions)
    .where(and(eq(userSessions.userId, session.userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastActiveAt));

  const currentId = sessions[0]?.id;
  if (!currentId) return { ok: true, revoked: 0 };

  const result = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, session.userId),
        isNull(userSessions.revokedAt),
        ne(userSessions.id, currentId),
      ),
    )
    .returning({ id: userSessions.id });

  revalidatePath('/app/settings/sessions');
  return { ok: true, revoked: result.length };
}
