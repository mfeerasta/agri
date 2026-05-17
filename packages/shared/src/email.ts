/**
 * Resend email client. Email is a secondary channel: it backs up WhatsApp
 * for approvers who prefer desktop. Templates use the Zameen visual identity
 * (deep green and ochre) and ship a plain-text fallback so the message
 * arrives even when remote images are blocked.
 */

import { Resend } from 'resend';

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&display=swap';

let _client: Resend | null = null;

function client(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  _client = new Resend(key);
  return _client;
}

function fromAddress(): string {
  return process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>';
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${title}</title>
<link rel="stylesheet" href="${FONT_LINK}" />
</head>
<body style="margin:0;padding:24px;background:#f5f1ea;font-family:system-ui,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e0d6;">
    <div style="background:${DEEP_GREEN};padding:20px 28px;">
      <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:700;color:${OCHRE};">Zameen</div>
    </div>
    <div style="padding:28px;line-height:1.55;">${bodyHtml}</div>
    <div style="padding:16px 28px;background:#faf7f1;border-top:1px solid #eee;font-size:12px;color:#666;">
      agri.feerasta.ai
    </div>
  </div>
</body></html>`;
}

export interface ApprovalRequestEmailInput {
  to: string;
  approverName: string;
  requesterName: string;
  type: string;
  amountPkrFormatted: string;
  title: string;
  deepLink: string;
}

/** Email the on-duty approver. CTA links back to the Approver PWA. */
export async function sendApprovalRequest(input: ApprovalRequestEmailInput): Promise<{ id: string }> {
  const html = shell(
    'Approval needed',
    `<p>Salaam ${input.approverName},</p>
     <p><strong>${input.requesterName}</strong> has submitted a <strong>${input.type}</strong> approval request for <strong>${input.amountPkrFormatted}</strong>.</p>
     <p style="margin:18px 0;padding:12px 16px;background:#faf7f1;border-left:4px solid ${OCHRE};">${input.title}</p>
     <p><a href="${input.deepLink}" style="display:inline-block;background:${DEEP_GREEN};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Open in Approver PWA</a></p>
     <p style="font-size:13px;color:#666;">Decisions are recorded with GPS and IP. Approve or reject inside the PWA.</p>`,
  );
  const text = `${input.requesterName} submitted a ${input.type} request for ${input.amountPkrFormatted}.\n${input.title}\nOpen: ${input.deepLink}`;
  const res = await client().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Approval: ${input.type} (${input.amountPkrFormatted})`,
    html,
    text,
  });
  if ((res as { error?: unknown }).error) throw new Error(`Resend send failed: ${JSON.stringify((res as { error: unknown }).error)}`);
  return { id: (res as { data?: { id: string } }).data?.id ?? '' };
}

export interface ApprovalDecisionEmailInput {
  to: string;
  recipientName: string;
  decision: 'approved' | 'rejected' | 'sent_back';
  type: string;
  title: string;
  deepLink: string;
  comment?: string;
}

/** Email the requester (and watchers) when a decision lands on their request. */
export async function sendApprovalDecision(input: ApprovalDecisionEmailInput): Promise<{ id: string }> {
  const verbMap = { approved: 'approved', rejected: 'rejected', sent_back: 'sent back to you' };
  const verb = verbMap[input.decision];
  const html = shell(
    `Request ${verb}`,
    `<p>Salaam ${input.recipientName},</p>
     <p>Your <strong>${input.type}</strong> request has been <strong>${verb}</strong>.</p>
     <p style="margin:18px 0;padding:12px 16px;background:#faf7f1;border-left:4px solid ${OCHRE};">${input.title}</p>
     ${input.comment ? `<p><em>Note:</em> ${input.comment}</p>` : ''}
     <p><a href="${input.deepLink}" style="display:inline-block;background:${DEEP_GREEN};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">View details</a></p>`,
  );
  const text = `Your ${input.type} request was ${verb}.\n${input.title}\n${input.comment ?? ''}\nView: ${input.deepLink}`;
  const res = await client().emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Request ${verb}: ${input.type}`,
    html,
    text,
  });
  if ((res as { error?: unknown }).error) throw new Error(`Resend send failed: ${JSON.stringify((res as { error: unknown }).error)}`);
  return { id: (res as { data?: { id: string } }).data?.id ?? '' };
}
