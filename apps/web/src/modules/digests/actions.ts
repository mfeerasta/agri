'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, digestSubscriptions } from '@zameen/db';
import {
  buildDailyDigest,
  buildWeeklyDigest,
  dailyDigestToSlack,
  dailyDigestToWhatsApp,
  postSlackBlocks,
  weeklyDigestToEmail,
} from '@zameen/shared';
import { getSessionContext } from '@/lib/session';
import { Resend } from 'resend';

interface SaveDigestInput {
  entityId: string;
  channel: 'slack' | 'email' | 'whatsapp';
  kind: 'daily' | 'weekly' | 'monthly';
  target: string;
  sendTimeLocal: string;
  timezone: string;
}

export async function saveDigestSubscription(input: SaveDigestInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  if (input.channel === 'slack' && !input.target.startsWith('https://hooks.slack.com/')) {
    return { ok: false, error: 'Slack target must be a hooks.slack.com webhook URL' };
  }
  if (input.channel === 'email' && !input.target.includes('@')) {
    return { ok: false, error: 'Email target must be an address' };
  }
  if (input.channel === 'whatsapp' && !/^\+?\d{7,}$/.test(input.target)) {
    return { ok: false, error: 'WhatsApp target must be a phone number' };
  }

  try {
    await db.insert(digestSubscriptions).values({
      entityId: input.entityId,
      channel: input.channel,
      kind: input.kind,
      target: input.target,
      sendTimeLocal: input.sendTimeLocal,
      timezone: input.timezone,
      createdBy: ctx.userId,
    });
    revalidatePath('/admin/digests');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function sendTestDigest(subscriptionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };

  const [sub] = await db.select().from(digestSubscriptions).where(eq(digestSubscriptions.id, subscriptionId)).limit(1);
  if (!sub) return { ok: false, error: 'Subscription not found' };

  try {
    if (sub.kind === 'weekly') {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - 6);
      const weekly = await buildWeeklyDigest(sub.entityId, start);
      const email = weeklyDigestToEmail(weekly);
      if (sub.channel === 'email') {
        const resend = new Resend(process.env.RESEND_API_KEY ?? '');
        await resend.emails.send({
          from: process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>',
          to: sub.target,
          subject: `[TEST] ${email.subject}`,
          html: email.html,
          text: email.text,
        });
      } else if (sub.channel === 'slack') {
        await postSlackBlocks(sub.target, {
          text: `[TEST] ${email.subject}`,
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*[TEST] Weekly digest preview*\n${email.subject}` } }],
        });
      } else {
        // best-effort whatsapp text
      }
    } else {
      const daily = await buildDailyDigest(sub.entityId, new Date());
      if (sub.channel === 'slack') {
        const payload = dailyDigestToSlack(daily);
        await postSlackBlocks(sub.target, { ...payload, text: `[TEST] ${payload.text}` });
      } else if (sub.channel === 'email') {
        const resend = new Resend(process.env.RESEND_API_KEY ?? '');
        await resend.emails.send({
          from: process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>',
          to: sub.target,
          subject: `[TEST] Zameen daily ops ${daily.date}`,
          html: `<pre style="font-family:system-ui,sans-serif;font-size:13px;">${escapeHtml(JSON.stringify(daily, null, 2))}</pre>`,
          text: JSON.stringify(daily, null, 2),
        });
      } else {
        // WhatsApp dispatch through existing client could go here.
        const text = dailyDigestToWhatsApp(daily);
        void text;
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
