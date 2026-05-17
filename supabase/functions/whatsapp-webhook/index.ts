// whatsapp-webhook
// POST handler for Meta WhatsApp Business delivery receipts.
// Updates zameen.notifications.sent_at when message is delivered and read_at when it is read.
// GET handler responds to Meta's hub.challenge verification.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id?: string;
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{ value?: { statuses?: MetaStatus[] } }>;
  }>;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === expected && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  let body: MetaPayload;
  try {
    body = await req.json() as MetaPayload;
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  const supabase = getServiceClient();
  let updated = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const externalId = status.id;
        const ts = new Date(Number(status.timestamp) * 1000).toISOString();
        const update: Record<string, string> = {};
        if (status.status === 'delivered' || status.status === 'sent') update.sent_at = ts;
        if (status.status === 'read') update.read_at = ts;
        if (status.status === 'failed') update.failed_reason = 'whatsapp_failed';
        if (Object.keys(update).length === 0) continue;
        const { error, count } = await supabase
          .from('notifications')
          .update(update, { count: 'exact' })
          .filter('payload->>wa_message_id', 'eq', externalId);
        if (!error) updated += count ?? 0;
      }
    }
  }

  return jsonResponse({ updated });
});
