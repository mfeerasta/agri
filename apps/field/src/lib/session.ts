import { createSupabaseServerClient } from './supabase/server.js';

export interface FieldSession {
  userId: string;
  entityId: string;
  workerId: string | null;
  workerName: string;
  workerPhotoUrl: string | null;
  role: 'worker' | 'supervisor' | 'farm_manager' | 'director' | 'admin';
  phone?: string;
}

export async function getFieldSession(): Promise<FieldSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    userId: data.user.id,
    entityId: (meta.default_entity_id as string) ?? (userMeta.default_entity_id as string) ?? '',
    workerId: (meta.worker_id as string) ?? null,
    workerName: (userMeta.full_name as string) ?? data.user.phone ?? 'Worker',
    workerPhotoUrl: (userMeta.photo_url as string) ?? null,
    role: ((meta.role as FieldSession['role']) ?? 'worker'),
    phone: data.user.phone ?? undefined,
  };
}
