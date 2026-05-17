'use server';
import { revalidatePath } from 'next/cache';
import { decide } from '@zameen/approvals';
import { getSessionContext } from '@/lib/session';

interface Payload {
  approvalRequestId: string;
  action: 'approve' | 'reject' | 'send_back' | 'escalate';
  comment?: string;
}

type Result = { ok: true } | { ok: false; error: string };

export async function decideAction(p: Payload): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  try {
    await decide({
      approvalRequestId: p.approvalRequestId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: p.action,
      comment: p.comment,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
  revalidatePath('/approve');
  return { ok: true };
}
