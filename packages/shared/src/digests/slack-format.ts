/**
 * Slack Block Kit formatter. Produces the JSON payload that posts cleanly
 * to a Slack incoming webhook. Keeps the secret webhook URL out of the
 * payload itself.
 */

import type { DailyDigest } from './builders.js';

const APPROVER_PWA_BASE = 'https://approve.agri.feerasta.ai';

function pkr(n: number | null): string {
  if (n == null) return 'No amount';
  return `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

function literFmt(n: number): string {
  return `${n.toLocaleString('en-PK', { maximumFractionDigits: 1 })} L`;
}

export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackPayload {
  text: string;
  blocks: SlackBlock[];
}

export function dailyDigestToSlack(digest: DailyDigest): SlackPayload {
  const blocks: SlackBlock[] = [];

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `Daily ops: ${digest.entityName}`,
      emoji: true,
    },
  });

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `*Date:* ${digest.date}  |  *Yesterday recap*` },
    ],
  });

  blocks.push({ type: 'divider' });

  const y = digest.yesterday;
  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Tasks done*\n${y.tasksCompleted}` },
      { type: 'mrkdwn', text: `*Tasks open*\n${y.tasksOpen}` },
      { type: 'mrkdwn', text: `*Attendance*\n${y.workersPresent} / ${y.workersExpected}` },
      { type: 'mrkdwn', text: `*Diesel*\n${literFmt(y.dieselConsumedLiters)} (${pkr(y.dieselCostPkr)})` },
      { type: 'mrkdwn', text: `*Repairs opened*\n${y.repairOpensCount}` },
      { type: 'mrkdwn', text: `*Anomalies*\n${y.anomaliesFlagged}` },
    ],
  });

  blocks.push({ type: 'divider' });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Today*\nScheduled tasks: ${digest.today.tasksScheduled}\nWeather: ${digest.today.weatherSummary}\nIrrigation due: ${digest.today.irrigationDue.length === 0 ? 'none' : digest.today.irrigationDue.join(', ')}`,
    },
  });

  if (digest.pendingApprovals.length > 3) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:warning: *${digest.pendingApprovals.length} approvals pending.* Some are over 24 hours old.`,
      },
    });
  }

  if (digest.pendingApprovals.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*Pending approvals*' },
    });

    for (const approval of digest.pendingApprovals.slice(0, 6)) {
      const link = `${APPROVER_PWA_BASE}/${approval.id}`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${approval.title}*\n${pkr(approval.amountPkr)}  |  ${approval.approverRole}  |  age ${approval.ageHours}h`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Approver PWA' },
          url: link,
          style: approval.ageHours > 24 ? 'danger' : 'primary',
        },
      });
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: 'Sent by Zameen. Adjust digests at agri.feerasta.ai/admin/digests' },
    ],
  });

  const fallback = `Daily ops ${digest.entityName} ${digest.date}: ${y.tasksCompleted} tasks done, ${y.workersPresent}/${y.workersExpected} present, ${digest.pendingApprovals.length} pending approvals.`;

  return { text: fallback, blocks };
}

export async function postSlackBlocks(webhookUrl: string, payload: SlackPayload): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(webhookUrl, {
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
