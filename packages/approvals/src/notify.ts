/**
 * Multi-channel approval event dispatcher.
 *
 * Fans an approval event out to the channels relevant for that audience:
 * in-app row (always), WhatsApp template (if recipient has phone), and
 * Resend email (if recipient has email). Each channel is independent —
 * one failure does not block the others. The WhatsApp message is purely
 * a phone ping with a deep link back to the Approver PWA.
 */

import { eq, inArray } from 'drizzle-orm';
import { db, notifications, users, entities } from '@zameen/db';
import type { ApprovalRequest, User } from '@zameen/db/types';
import { sendTemplate, WhatsAppError, sendPushToUser } from '@zameen/shared';
import { Resend } from 'resend';
import type { Locale } from '@zameen/locale';
import { templateForEvent, type ApprovalTemplate, type TemplateRenderInput } from './templates.js';

export type NotifyEvent =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'escalation_reminder';

export type NotifyChannel = 'whatsapp' | 'email' | 'in_app' | 'push';

/**
 * Map a NotifyEvent to the `notification_prefs` JSONB key on users.
 * Keep stable: changing these breaks the prefs UI.
 */
function prefsKeyForEvent(event: NotifyEvent): string {
  switch (event) {
    case 'submitted':
      return 'approvalSubmitted';
    case 'approved':
    case 'rejected':
    case 'sent_back':
      return 'approvalDecided';
    case 'escalation_reminder':
      return 'escalationReminder';
  }
}

function channelsForRecipient(
  recipient: User,
  event: NotifyEvent,
  fallback: NotifyChannel[],
): NotifyChannel[] {
  const prefs = (recipient as User & { notificationPrefs?: Record<string, unknown> }).notificationPrefs;
  if (!prefs || typeof prefs !== 'object') return fallback;
  const raw = (prefs as Record<string, unknown>)[prefsKeyForEvent(event)];
  if (!Array.isArray(raw)) return fallback;
  const allowed = new Set<NotifyChannel>(['in_app', 'whatsapp', 'email', 'push']);
  const filtered = raw.filter((c): c is NotifyChannel => typeof c === 'string' && allowed.has(c as NotifyChannel));
  // Always allow caller-passed restriction to narrow further.
  return fallback.filter((c) => filtered.includes(c));
}

export interface NotifyInput {
  request: ApprovalRequest;
  event: NotifyEvent;
  channels?: NotifyChannel[];
  comment?: string;
  ageHours?: number;
}

export interface ChannelResult {
  channel: NotifyChannel;
  recipientId: string;
  ok: boolean;
  reason?: string;
  messageId?: string;
}

export interface NotifyResult {
  results: ChannelResult[];
}

function pickLocale(user: User | null): Locale {
  const pref = (user?.preferredLocale as Locale | undefined) ?? 'en';
  if (pref === 'ur' || pref === 'roman_ur' || pref === 'en') return pref;
  return 'en';
}

function recipientIdsForEvent(request: ApprovalRequest, event: NotifyEvent): string[] {
  const ids = new Set<string>();
  switch (event) {
    case 'submitted':
      if (request.currentApproverId) ids.add(request.currentApproverId);
      break;
    case 'escalation_reminder':
      if (request.currentApproverId) ids.add(request.currentApproverId);
      if (request.requestedBy) ids.add(request.requestedBy);
      break;
    case 'approved':
    case 'rejected':
    case 'sent_back':
      if (request.requestedBy) ids.add(request.requestedBy);
      break;
  }
  return [...ids];
}

let _resend: Resend | null = null;
function resendClient(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  _resend = new Resend(key);
  return _resend;
}

function fromAddress(): string {
  return process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>';
}

async function fetchRecipients(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}

async function fetchRequesterName(request: ApprovalRequest): Promise<string> {
  const [requester] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, request.requestedBy))
    .limit(1);
  return requester?.fullName ?? 'A team member';
}

async function fetchEntityName(request: ApprovalRequest): Promise<string> {
  const [row] = await db
    .select({ name: entities.name })
    .from(entities)
    .where(eq(entities.id, request.entityId))
    .limit(1);
  return row?.name ?? 'AGRI';
}

async function dispatchInApp(
  recipient: User,
  template: ApprovalTemplate,
  renderInput: TemplateRenderInput,
  request: ApprovalRequest,
  event: NotifyEvent,
  comment?: string,
): Promise<ChannelResult> {
  const enInput: TemplateRenderInput = { ...renderInput, locale: 'en' };
  const urInput: TemplateRenderInput = { ...renderInput, locale: 'ur' };
  try {
    await db.insert(notifications).values({
      recipientId: recipient.id,
      entityId: request.entityId,
      channel: 'in_app',
      category: 'approval_event',
      title: template.inAppTitle(enInput),
      body: template.inAppBody(enInput),
      bodyUr: template.inAppBody(urInput),
      deepLink: template.deepLink(request),
      payload: {
        approvalRequestId: request.id,
        event,
        approvalType: request.approvalType,
        comment: comment ?? null,
      },
      sentAt: new Date(),
    });
    return { channel: 'in_app', recipientId: recipient.id, ok: true };
  } catch (e) {
    return {
      channel: 'in_app',
      recipientId: recipient.id,
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

async function dispatchWhatsapp(
  recipient: User,
  template: ApprovalTemplate,
  renderInput: TemplateRenderInput,
  request: ApprovalRequest,
  event: NotifyEvent,
): Promise<ChannelResult> {
  if (!recipient.phone) {
    return { channel: 'whatsapp', recipientId: recipient.id, ok: false, reason: 'no_phone' };
  }
  const locale = pickLocale(recipient);
  const localeCode = locale === 'ur' ? 'ur' : 'en';
  const parameters = template.whatsappParameters({ ...renderInput, locale });
  const deepLink = template.deepLink(request);
  try {
    const result = await sendTemplate({
      to: recipient.phone,
      templateName: template.whatsappTemplateName,
      languageCode: localeCode,
      parameters,
      buttonUrlParameter: deepLink,
    });
    await db.insert(notifications).values({
      recipientId: recipient.id,
      entityId: request.entityId,
      channel: 'whatsapp',
      category: 'approval_event',
      title: template.inAppTitle({ ...renderInput, locale }),
      body: template.inAppBody({ ...renderInput, locale }),
      deepLink,
      payload: {
        approvalRequestId: request.id,
        event,
        messageId: result.messageId,
        templateName: template.whatsappTemplateName,
      },
      sentAt: new Date(),
    });
    return { channel: 'whatsapp', recipientId: recipient.id, ok: true, messageId: result.messageId };
  } catch (e) {
    const reason = e instanceof WhatsAppError
      ? `whatsapp_${e.statusCode}: ${e.message}`
      : e instanceof Error
        ? e.message
        : String(e);
    try {
      await db.insert(notifications).values({
        recipientId: recipient.id,
        entityId: request.entityId,
        channel: 'whatsapp',
        category: 'approval_event',
        title: template.inAppTitle({ ...renderInput, locale }),
        body: template.inAppBody({ ...renderInput, locale }),
        deepLink,
        payload: { approvalRequestId: request.id, event, templateName: template.whatsappTemplateName },
        failedReason: reason,
      });
    } catch {
      // swallow logging failure
    }
    return { channel: 'whatsapp', recipientId: recipient.id, ok: false, reason };
  }
}

function appForRequest(_request: ApprovalRequest): 'approve' | 'web' | 'field' | 'ops' | 'any' {
  // Approval events always deep-link into the Approver PWA, so target the
  // 'approve' subscription set. Fall back to 'any' if the user has no
  // approve-app subscription (handled inside sendPushToUser).
  return 'approve';
}

async function dispatchPush(
  recipient: User,
  template: ApprovalTemplate,
  renderInput: TemplateRenderInput,
  request: ApprovalRequest,
  event: NotifyEvent,
): Promise<ChannelResult> {
  const title = template.pushTitle(renderInput);
  const body = template.pushBody(renderInput);
  const tag = template.pushTag(request);
  const priority = template.pushPriority(renderInput);
  const deepLink = template.deepLink(request);
  try {
    const targetApp = appForRequest(request);
    let result = await sendPushToUser(recipient.id, targetApp, {
      title,
      body,
      deepLink,
      tag,
      priority,
    });
    if (result.sent === 0 && result.failed === 0) {
      // Recipient has no approve-app subscription — try any device.
      result = await sendPushToUser(recipient.id, 'any', {
        title,
        body,
        deepLink,
        tag,
        priority,
      });
    }
    try {
      await db.insert(notifications).values({
        recipientId: recipient.id,
        entityId: request.entityId,
        channel: 'push',
        category: 'approval_event',
        title,
        body,
        deepLink,
        payload: {
          approvalRequestId: request.id,
          event,
          sent: result.sent,
          failed: result.failed,
        },
        sentAt: result.sent > 0 ? new Date() : null,
        failedReason: result.sent === 0 ? 'no_subscription_or_send_failed' : null,
      });
    } catch {
      // ignore log failure
    }
    return {
      channel: 'push',
      recipientId: recipient.id,
      ok: result.sent > 0,
      reason: result.sent === 0 ? `sent=0 failed=${result.failed}` : undefined,
    };
  } catch (e) {
    return {
      channel: 'push',
      recipientId: recipient.id,
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

async function dispatchEmail(
  recipient: User,
  template: ApprovalTemplate,
  renderInput: TemplateRenderInput,
  request: ApprovalRequest,
  event: NotifyEvent,
): Promise<ChannelResult> {
  if (!recipient.email) {
    return { channel: 'email', recipientId: recipient.id, ok: false, reason: 'no_email' };
  }
  const locale = pickLocale(recipient);
  const subject = template.emailSubject({ ...renderInput, locale });
  const { html, text } = template.emailBody({ ...renderInput, locale });
  const deepLink = template.deepLink(request);
  try {
    const res = await resendClient().emails.send({
      from: fromAddress(),
      to: recipient.email,
      subject,
      html,
      text,
    });
    const err = (res as { error?: unknown }).error;
    if (err) throw new Error(`Resend send failed: ${JSON.stringify(err)}`);
    const messageId = (res as { data?: { id: string } }).data?.id ?? '';
    await db.insert(notifications).values({
      recipientId: recipient.id,
      entityId: request.entityId,
      channel: 'email',
      category: 'approval_event',
      title: subject,
      body: text,
      deepLink,
      payload: { approvalRequestId: request.id, event, messageId },
      sentAt: new Date(),
    });
    return { channel: 'email', recipientId: recipient.id, ok: true, messageId };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    try {
      await db.insert(notifications).values({
        recipientId: recipient.id,
        entityId: request.entityId,
        channel: 'email',
        category: 'approval_event',
        title: subject,
        body: text,
        deepLink,
        payload: { approvalRequestId: request.id, event },
        failedReason: reason,
      });
    } catch {
      // swallow
    }
    return { channel: 'email', recipientId: recipient.id, ok: false, reason };
  }
}

/**
 * Fan an approval event out to the relevant channels. Each leg is
 * independent: one channel failing does not block the others. Returns
 * per-channel per-recipient results so callers can log granularly.
 */
export async function notifyApprovalEvent(input: NotifyInput): Promise<NotifyResult> {
  const channels: NotifyChannel[] = input.channels ?? ['in_app', 'whatsapp', 'email', 'push'];
  const recipientIds = recipientIdsForEvent(input.request, input.event);
  if (recipientIds.length === 0) return { results: [] };

  const recipients = await fetchRecipients(recipientIds);
  if (recipients.length === 0) return { results: [] };

  const template = templateForEvent(input.event);

  const [requesterName, entityName] = await Promise.all([
    fetchRequesterName(input.request),
    fetchEntityName(input.request),
  ]);

  const decisionForEvent: 'approved' | 'rejected' | 'sent_back' | undefined =
    input.event === 'approved' ? 'approved'
      : input.event === 'rejected' ? 'rejected'
        : input.event === 'sent_back' ? 'sent_back'
          : undefined;

  const tasks: Array<Promise<ChannelResult>> = [];
  for (const recipient of recipients) {
    const locale = pickLocale(recipient);
    const renderInput: TemplateRenderInput = {
      request: input.request,
      event: input.event,
      locale,
      decision: decisionForEvent,
      comment: input.comment,
      ageHours: input.ageHours,
      requesterName,
      entityName,
    };
    const effective = channelsForRecipient(recipient, input.event, channels);
    if (effective.includes('in_app')) {
      tasks.push(dispatchInApp(recipient, template, renderInput, input.request, input.event, input.comment));
    }
    if (effective.includes('whatsapp')) {
      tasks.push(dispatchWhatsapp(recipient, template, renderInput, input.request, input.event));
    }
    if (effective.includes('email')) {
      tasks.push(dispatchEmail(recipient, template, renderInput, input.request, input.event));
    }
    if (effective.includes('push')) {
      tasks.push(dispatchPush(recipient, template, renderInput, input.request, input.event));
    }
  }

  const settled = await Promise.allSettled(tasks);
  const results: ChannelResult[] = settled.map((s) =>
    s.status === 'fulfilled'
      ? s.value
      : { channel: 'in_app', recipientId: '', ok: false, reason: String(s.reason) },
  );
  return { results };
}
