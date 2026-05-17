'use server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { decide } from '@zameen/approvals';
import type { UserRole } from '@zameen/shared';

interface DecisionPayload {
  approvalRequestId: string;
  action: 'approve' | 'reject' | 'send_back' | 'escalate';
  comment?: string;
  gpsLocation?: { lat: number; lng: number; accuracyM?: number };
}

export async function decideAction(p: DecisionPayload): Promise<{ ok: true } | { ok: false; error: string }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: 'Not authenticated' };
  const role = ((data.user.app_metadata as { role?: UserRole })?.role) ?? 'worker';

  try {
    await decide({
      approvalRequestId: p.approvalRequestId,
      actorUserId: data.user.id,
      actorRole: role,
      action: p.action,
      comment: p.comment,
      gpsLocation: p.gpsLocation,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
  revalidatePath(`/${p.approvalRequestId}`);
  revalidatePath('/');
  return { ok: true };
}
