import { createSupabaseServerClient } from './supabase/server.js';
import type { UserRole } from '@zameen/shared';

export interface SessionContext {
  userId: string;
  entityId: string;
  role: UserRole;
  email?: string;
  phone?: string;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    userId: data.user.id,
    entityId: (meta.default_entity_id as string) ?? (userMeta.default_entity_id as string) ?? '',
    role: (meta.role as UserRole) ?? 'worker',
    email: data.user.email ?? undefined,
    phone: data.user.phone ?? undefined,
  };
}
