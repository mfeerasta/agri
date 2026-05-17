/**
 * Thin client for Meta WhatsApp Business Cloud API v20.
 *
 * WhatsApp is notification-only on this platform: it deep-links to the
 * Approver PWA where the full decision context is rendered. Approving or
 * rejecting from inside WhatsApp is deliberately not supported, so this
 * client only sends templates, never receives webhooks here.
 */

const GRAPH_VERSION = 'v20.0';

export interface WhatsAppSendResult {
  messageId: string;
  status: 'sent';
}

export class WhatsAppError extends Error {
  constructor(public statusCode: number, public body: unknown, message: string) {
    super(message);
    this.name = 'WhatsAppError';
  }
}

function endpoint(): string {
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneId) throw new WhatsAppError(0, null, 'META_WHATSAPP_PHONE_NUMBER_ID not set');
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
}

function token(): string {
  const t = process.env.META_WHATSAPP_TOKEN;
  if (!t) throw new WhatsAppError(0, null, 'META_WHATSAPP_TOKEN not set');
  return t;
}

async function postTemplate(payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new WhatsAppError(res.status, body, `WhatsApp send failed: ${res.status}`);
  }
  const messageId = (body as { messages?: Array<{ id: string }> }).messages?.[0]?.id ?? '';
  return { messageId, status: 'sent' };
}

export interface ApprovalRequestTemplateInput {
  to: string;
  requesterName: string;
  type: string;
  amountPkrFormatted: string;
  deepLink: string;
  languageCode?: string;
}

/**
 * Send the approval-request template so the approver gets a phone ping
 * with the deep link back to the Approver PWA. Decision happens there.
 */
export async function sendApprovalRequestTemplate(
  input: ApprovalRequestTemplateInput,
): Promise<WhatsAppSendResult> {
  return postTemplate({
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: 'zameen_approval_request',
      language: { code: input.languageCode ?? 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: input.requesterName },
            { type: 'text', text: input.type },
            { type: 'text', text: input.amountPkrFormatted },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: input.deepLink }],
        },
      ],
    },
  });
}

export interface ApprovalDecisionTemplateInput {
  to: string;
  decision: 'approved' | 'rejected' | 'sent_back';
  type: string;
  deepLink: string;
  languageCode?: string;
}

/** Notify the requester (or watchers) of an approval decision via template. */
export async function sendApprovalDecisionTemplate(
  input: ApprovalDecisionTemplateInput,
): Promise<WhatsAppSendResult> {
  return postTemplate({
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: 'zameen_approval_decision',
      language: { code: input.languageCode ?? 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: input.decision },
            { type: 'text', text: input.type },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: input.deepLink }],
        },
      ],
    },
  });
}

export interface OtpTemplateInput {
  to: string;
  code: string;
  languageCode?: string;
}

/** Send the OTP template used for phone-based login. */
export async function sendOtpTemplate(input: OtpTemplateInput): Promise<WhatsAppSendResult> {
  return postTemplate({
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: 'zameen_otp',
      language: { code: input.languageCode ?? 'en' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: input.code }] },
      ],
    },
  });
}
