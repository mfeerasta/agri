'use server';

import { db, userEntityRoles } from '@zameen/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '../../../../../lib/session';
import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

const ASSIGNABLE_ROLES = [
  'super_admin',
  'director',
  'farm_manager',
  'supervisor',
  'accountant',
  'auditor',
  'worker',
  'viewer',
] as const;

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export async function assignRole(input: { userId: string; role: AssignableRole }): Promise<void> {
  const session = await getSessionContext();
  if (!session) throw new Error('Not authenticated');
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new Error('Invalid role');

  const existing = await db
    .select()
    .from(userEntityRoles)
    .where(
      and(
        eq(userEntityRoles.userId, input.userId),
        eq(userEntityRoles.entityId, session.entityId),
        eq(userEntityRoles.role, input.role),
      ),
    );
  if (existing.length === 0) {
    await db.insert(userEntityRoles).values({
      userId: input.userId,
      entityId: session.entityId,
      role: input.role,
      isActive: true,
    });
  } else {
    await db
      .update(userEntityRoles)
      .set({ isActive: true })
      .where(eq(userEntityRoles.id, existing[0].id));
  }
  revalidatePath('/app/admin/users');
}

export async function revokeRole(input: { userId: string; role: AssignableRole }): Promise<void> {
  const session = await getSessionContext();
  if (!session) throw new Error('Not authenticated');
  await db
    .update(userEntityRoles)
    .set({ isActive: false })
    .where(
      and(
        eq(userEntityRoles.userId, input.userId),
        eq(userEntityRoles.entityId, session.entityId),
        eq(userEntityRoles.role, input.role),
      ),
    );
  revalidatePath('/app/admin/users');
}

/**
 * Invite an external auditor by email. Sends a Supabase magic-link with a
 * 14-day TTL and pre-assigns the auditor role on the active entity so the
 * first login lands on a read-only session.
 */
export async function inviteAuditor(input: { email: string }): Promise<void> {
  const session = await getSessionContext();
  if (!session) throw new Error('Not authenticated');
  const sb = await createSupabaseServerClient();

  const { data, error } = await sb.auth.admin.inviteUserByEmail(input.email, {
    data: { default_entity_id: session.entityId, pre_assign_role: 'auditor' },
  });
  if (error) throw new Error(error.message);
  if (data?.user) {
    await db.insert(userEntityRoles).values({
      userId: data.user.id,
      entityId: session.entityId,
      role: 'auditor',
      isActive: true,
    });
  }
  revalidatePath('/app/admin/users');
}
