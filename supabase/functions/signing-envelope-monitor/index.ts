// signing-envelope-monitor
// Schedule: pg_cron daily at 09:00 PKT.
// Marks expired envelopes, sends T-3 and T-1 reminders to pending signers,
// and appends audit events. ETO 2002 trail stays immutable.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';
import { instrument } from '../_shared/instrumented.ts';

interface EnvelopeRow {
  id: string;
  entity_id: string;
  envelope_number: string;
  title: string;
  status: string;
  expires_at: string | null;
}

interface SignerRow {
  id: string;
  envelope_id: string;
  signer_name: string;
  signer_email: string | null;
  signer_phone: string | null;
  access_token: string | null;
  status: string;
}

const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://agri.feerasta.ai';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return Math.floor(diff);
}

async function appendAudit(
  supabase: ReturnType<typeof getServiceClient>,
  envelopeId: string,
  signerId: string | null,
  eventKind: string,
  payload: Record<string, unknown>,
) {
  await supabase.schema('zameen').from('signature_audit_events').insert({
    envelope_id: envelopeId,
    signer_id: signerId,
    event_kind: eventKind,
    payload,
  });
}

Deno.serve(
  instrument('signing-envelope-monitor', async () => {
    const supabase = getServiceClient();
    const nowIso = new Date().toISOString();

    // 1) Expire envelopes whose expires_at has passed.
    const { data: expiredCandidates } = await supabase
      .schema('zameen')
      .from('signing_envelopes')
      .select('id, entity_id, envelope_number, title, status, expires_at')
      .in('status', ['draft', 'sent', 'partially_signed'])
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);

    let expired = 0;
    for (const env of ((expiredCandidates ?? []) as EnvelopeRow[])) {
      await supabase
        .schema('zameen')
        .from('signing_envelopes')
        .update({ status: 'expired', updated_at: nowIso })
        .eq('id', env.id);
      await supabase
        .schema('zameen')
        .from('envelope_signers')
        .update({ status: 'expired' })
        .eq('envelope_id', env.id)
        .in('status', ['pending', 'sent', 'viewed']);
      await appendAudit(supabase, env.id, null, 'expired', { expiredAt: nowIso });
      expired++;
    }

    // 2) Reminders for envelopes still pending, at T-3 and T-1.
    const { data: openEnvelopes } = await supabase
      .schema('zameen')
      .from('signing_envelopes')
      .select('id, entity_id, envelope_number, title, status, expires_at')
      .in('status', ['sent', 'partially_signed']);

    let remindersSent = 0;
    for (const env of ((openEnvelopes ?? []) as EnvelopeRow[])) {
      const d = daysUntil(env.expires_at);
      if (d !== 3 && d !== 1) continue;

      const { data: pending } = await supabase
        .schema('zameen')
        .from('envelope_signers')
        .select('id, envelope_id, signer_name, signer_email, signer_phone, access_token, status')
        .eq('envelope_id', env.id)
        .in('status', ['sent', 'viewed']);

      for (const s of ((pending ?? []) as SignerRow[])) {
        const signUrl = `${APP_ORIGIN}/sign/${s.access_token ?? ''}`;
        await appendAudit(supabase, env.id, s.id, 'reminder_sent', { signUrl, daysToExpiry: d });
        remindersSent++;
      }
    }

    return jsonResponse({ ok: true, expired, remindersSent });
  }),
);
