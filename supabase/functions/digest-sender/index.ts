// digest-sender
// Schedule: every 15 minutes via pg_cron.
// Walks zameen.digest_subscriptions, finds rows whose local send time has
// passed and which have not yet been sent today, builds the payload by
// channel, dispatches it, and stamps last_sent_at on success.
//
// This function is intentionally Deno-self-contained: it does not import
// the Node @zameen/shared package (different runtime). Instead it inlines
// the formatting logic in TS so the Edge Function can ship without bundler
// gymnastics. Keep parity with packages/shared/src/digests/*.

import { getServiceClient, jsonResponse } from '../_shared/supabase.ts';

const APPROVER_PWA_BASE = 'https://approve.agri.feerasta.ai';

interface Subscription {
  id: string;
  entity_id: string;
  channel: 'slack' | 'email' | 'whatsapp';
  target: string;
  kind: 'daily' | 'weekly' | 'monthly';
  send_time_local: string;
  timezone: string;
  last_sent_at: string | null;
  custom_filters: Record<string, unknown>;
}

function nowInTz(timezone: string): { iso: string; date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const h = Number(get('hour'));
  const m = Number(get('minute'));
  return { iso: `${date}T${get('hour')}:${get('minute')}:00`, date, minutes: h * 60 + m };
}

function parseHhMm(text: string): number {
  const [h, m] = text.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function pkrFmt(n: number | null): string {
  if (n == null) return 'No amount';
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

async function dispatchSlack(target: string, payload: unknown): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

async function dispatchEmail(target: string, subject: string, html: string, text: string): Promise<{ ok: boolean; detail?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, detail: 'RESEND_API_KEY not set' };
  const from = Deno.env.get('ZAMEEN_EMAIL_FROM') ?? 'Zameen <notifications@agri.feerasta.ai>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ from, to: target, subject, html, text }),
    });
    if (!res.ok) return { ok: false, detail: `Resend ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

async function dispatchWhatsApp(target: string, body: string): Promise<{ ok: boolean; detail?: string }> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID');
  if (!token || !phoneId) return { ok: false, detail: 'WhatsApp not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: target,
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) return { ok: false, detail: `WhatsApp ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

async function buildDailyPayload(supabase: ReturnType<typeof getServiceClient>, entityId: string, date: string): Promise<Record<string, unknown>> {
  const yesterday = (() => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const { data: entity } = await supabase.from('entities').select('id,name').eq('id', entityId).maybeSingle();
  const entityName = (entity as { name?: string } | null)?.name ?? 'Unknown entity';

  const [tasksDone, tasksOpen, tasksToday, present, expected, diesel, repairs, anomalies, pending] = await Promise.all([
    supabase.from('task_completions').select('id', { count: 'exact', head: true }).gte('completed_at', `${yesterday}T00:00:00Z`).lte('completed_at', `${yesterday}T23:59:59Z`),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('status', 'open'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('scheduled_for', date),
    supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('work_date', yesterday).eq('status', 'present'),
    supabase.from('workers').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('is_active', true),
    supabase.from('diesel_daily_logs').select('diesel_filled_liters,total_cost_pkr').eq('entity_id', entityId).eq('log_date', yesterday),
    supabase.from('repair_requests').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).gte('created_at', `${yesterday}T00:00:00Z`).lte('created_at', `${yesterday}T23:59:59Z`),
    supabase.from('diesel_anomalies').select('id', { count: 'exact', head: true }).eq('entity_id', entityId).eq('detected_on', yesterday),
    supabase.from('approval_requests').select('id,title,amount_pkr,submitted_at,created_at,state').eq('entity_id', entityId).in('state', ['submitted', 'pending_supervisor', 'pending_farm_manager', 'pending_director', 'escalated']).order('created_at', { ascending: false }).limit(20),
  ]);

  const dieselRows = (diesel.data ?? []) as Array<{ diesel_filled_liters: string; total_cost_pkr: string }>;
  const dieselLiters = dieselRows.reduce((s, r) => s + Number(r.diesel_filled_liters), 0);
  const dieselPkr = dieselRows.reduce((s, r) => s + Number(r.total_cost_pkr), 0);
  const pendingRows = (pending.data ?? []) as Array<{ id: string; title: string; amount_pkr: string | null; submitted_at: string | null; created_at: string }>;

  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: `Daily ops: ${entityName}`, emoji: true } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `*Date:* ${date}  |  *Yesterday recap*` }] },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Tasks done*\n${tasksDone.count ?? 0}` },
        { type: 'mrkdwn', text: `*Tasks open*\n${tasksOpen.count ?? 0}` },
        { type: 'mrkdwn', text: `*Attendance*\n${present.count ?? 0} / ${expected.count ?? 0}` },
        { type: 'mrkdwn', text: `*Diesel*\n${dieselLiters.toFixed(1)} L (${pkrFmt(dieselPkr)})` },
        { type: 'mrkdwn', text: `*Repairs opened*\n${repairs.count ?? 0}` },
        { type: 'mrkdwn', text: `*Anomalies*\n${anomalies.count ?? 0}` },
      ],
    },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*Today*\nScheduled tasks: ${tasksToday.count ?? 0}` } },
  ];

  if (pendingRows.length > 3) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:warning: *${pendingRows.length} approvals pending.* Some may be over 24h old.` },
    });
  }
  for (const a of pendingRows.slice(0, 6)) {
    const ageHours = Math.round((Date.now() - new Date(a.submitted_at ?? a.created_at).getTime()) / 3_600_000);
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${a.title}*\n${pkrFmt(a.amount_pkr ? Number(a.amount_pkr) : null)}  |  age ${ageHours}h` },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Open Approver PWA' },
        url: `${APPROVER_PWA_BASE}/${a.id}`,
        style: ageHours > 24 ? 'danger' : 'primary',
      },
    });
  }

  return {
    text: `Daily ops ${entityName} ${date}: ${tasksDone.count ?? 0} tasks done, ${pendingRows.length} pending approvals.`,
    blocks,
  };
}

Deno.serve(async () => {
  const supabase = getServiceClient();
  const sentResults: Array<{ id: string; channel: string; ok: boolean; detail?: string }> = [];

  const { data: subs, error } = await supabase
    .from('digest_subscriptions')
    .select('*')
    .eq('enabled', true);

  if (error) return jsonResponse({ error: error.message }, 500);

  for (const row of (subs ?? []) as Subscription[]) {
    const localNow = nowInTz(row.timezone);
    const target = parseHhMm(row.send_time_local);
    if (localNow.minutes < target) continue;

    if (row.last_sent_at) {
      const lastDate = new Date(row.last_sent_at);
      const lastLocal = nowInTz(row.timezone);
      void lastLocal;
      const lastIso = new Intl.DateTimeFormat('en-CA', { timeZone: row.timezone }).format(lastDate);
      if (lastIso === localNow.date) continue;
    }

    if (row.kind !== 'daily') {
      sentResults.push({ id: row.id, channel: row.channel, ok: true, detail: 'kind-skipped' });
      continue;
    }

    let result: { ok: boolean; detail?: string };
    if (row.channel === 'slack') {
      const payload = await buildDailyPayload(supabase, row.entity_id, localNow.date);
      result = await dispatchSlack(row.target, payload);
    } else if (row.channel === 'email') {
      const payload = await buildDailyPayload(supabase, row.entity_id, localNow.date);
      const html = `<pre style="font-family:system-ui,sans-serif;">${JSON.stringify(payload, null, 2)}</pre>`;
      result = await dispatchEmail(row.target, `Daily ops digest, ${localNow.date}`, html, JSON.stringify(payload, null, 2));
    } else {
      result = await dispatchWhatsApp(row.target, `Zameen daily digest for ${localNow.date}. Open ${APPROVER_PWA_BASE}`);
    }

    sentResults.push({ id: row.id, channel: row.channel, ok: result.ok, detail: result.detail });

    if (result.ok) {
      await supabase
        .from('digest_subscriptions')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  return jsonResponse({ sent: sentResults.length, results: sentResults });
});
