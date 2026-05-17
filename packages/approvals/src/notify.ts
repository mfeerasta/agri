/**
 * Multi-channel approval event dispatcher.
 *
 * Fans an approval event out to the channels relevant for that audience:
 * in-app row (always), WhatsApp template (if approver has phone), and
 * Resend email (if approver has email). WhatsApp is notification-only:
 * the message body deep-links to the Approver PWA where the full decision
 * context lives.
 */

import { eq } from 'drizzle-orm';
import { db, notifications, users } from '@zameen/db';
import type { ApprovalRequest } from '@zameen/db/types';
import {
  sendApprovalRequestTemplate,
  sendApprovalDecisionTemplate,
  sendApprovalRequest as sendApprovalRequestEmail,
  sendApprovalDecision as sendApprovalDecisionEmail,
  formatPkr,
  fromRupees,
} from '@zameen/shared';
import { t } from '@zameen/locale';

export type NotifyEvent =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'escalation_reminder';

export type NotifyChannel = 'whatsapp' | 'email' | 'in_app';

export interface NotifyInput {
  request: ApprovalRequest;
  event: NotifyEvent;
  channels?: NotifyChannel[];
  comment?: string;
}

interface TemplateText {
  title: string;
  titleUr: string;
  body: string;
  bodyUr: string;
}

function template(event: NotifyEvent, request: ApprovalRequest): TemplateText {
  const type = request.approvalType;
  const amount = request.amountPkr ? formatPkr(fromRupees(request.amountPkr), 'lac_crore') : '';
  switch (event) {
    case 'submitted':
      return {
        title: `New ${type} approval needed`,
        titleUr: `${t('approval.pending', 'ur')}: ${type}`,
        body: `${request.title} ${amount ? `(${amount})` : ''}`.trim(),
        bodyUr: `${request.titleUr ?? request.title} ${amount}`.trim(),
      };
    case 'approved':
      return {
        title: `Request approved: ${type}`,
        titleUr: `${t('approval.approved', 'ur')}: ${type}`,
        body: request.title,
        bodyUr: request.titleUr ?? request.title,
      };
    case 'rejected':
      return {
        title: `Request rejected: ${type}`,
        titleUr: `${t('approval.rejected', 'ur')}: ${type}`,
        body: request.title,
        bodyUr: request.titleUr ?? request.title,
      };
    case 'sent_back':
      return {
        title: `Request sent back: ${type}`,
        titleUr: `واپس بھیجی گئی: ${type}`,
        body: request.title,
        bodyUr: request.titleUr ?? request.title,
      };
    case 'escalation_reminder':
      return {
        title: `Reminder: ${type} pending decision`,
        titleUr: `یاد دہانی: ${type}`,
        body: request.title,
        bodyUr: request.titleUr ?? request.title,
      };
  }
}

function deepLinkFor(requestId: string): string {
  const base = process.env.NEXT_PUBLIC_APPROVE_URL ?? 'https://approve.agri.feerasta.ai';
  return `${base}/${requestId}`;
}

function recipientForEvent(request: ApprovalRequest, event: NotifyEvent): string | null {
  if (event === 'submitted' || event === 'escalation_reminder') {
    return request.currentApproverId ?? null;
  }
  return request.requestedBy;
}

/**
 * Fan an approval event out to the relevant channels. Each leg is independent:
 * one channel failing does not block the others.
 */
export async function notifyApprovalEvent(input: NotifyInput): Promise<void> {
  const channels: NotifyChannel[] = input.channels ?? ['in_app', 'whatsapp', 'email'];
  const tmpl = template(input.event, input.request);
  const deepLink = deepLinkFor(input.request.id);
  const recipientId = recipientForEvent(input.request, input.event);
  if (!recipientId) return;

  const [recipient] = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
  if (!recipient) return;

  const tasks: Array<Promise<unknown>> = [];

  if (channels.includes('in_app')) {
    tasks.push(
      db.insert(notifications).values({
        recipientId,
        entityId: input.request.entityId,
        channel: 'in_app',
        category: `approval.${input.event}`,
        title: tmpl.title,
        body: tmpl.body,
        bodyUr: tmpl.bodyUr,
        deepLink,
        payload: { approvalRequestId: input.request.id, comment: input.comment ?? null },
        sentAt: new Date(),
      }),
    );
  }

  if (channels.includes('whatsapp') && recipient.phone) {
    const amount = input.request.amountPkr
      ? formatPkr(fromRupees(input.request.amountPkr), 'lac_crore')
      : 'n/a';
    const send =
      input.event === 'submitted' || input.event === 'escalation_reminder'
        ? sendApprovalRequestTemplate({
            to: recipient.phone,
            requesterName: recipient.fullName,
            type: input.request.approvalType,
            amountPkrFormatted: amount,
            deepLink,
            languageCode: recipient.preferredLocale === 'ur' ? 'ur' : 'en',
          })
        : sendApprovalDecisionTemplate({
            to: recipient.phone,
            decision: input.event === 'approved' ? 'approved' : input.event === 'rejected' ? 'rejected' : 'sent_back',
            type: input.request.approvalType,
            deepLink,
            languageCode: recipient.preferredLocale === 'ur' ? 'ur' : 'en',
          });
    tasks.push(
      send.catch(async (e: unknown) => {
        await db.insert(notifications).values({
          recipientId,
          entityId: input.request.entityId,
          channel: 'whatsapp',
          category: `approval.${input.event}`,
          title: tmpl.title,
          body: tmpl.body,
          deepLink,
          failedReason: e instanceof Error ? e.message : String(e),
        });
      }),
    );
  }

  if (channels.includes('email') && recipient.email) {
    const amount = input.request.amountPkr
      ? formatPkr(fromRupees(input.request.amountPkr), 'lac_crore')
      : 'n/a';
    const send =
      input.event === 'submitted' || input.event === 'escalation_reminder'
        ? sendApprovalRequestEmail({
            to: recipient.email,
            approverName: recipient.fullName,
            requesterName: recipient.fullName,
            type: input.request.approvalType,
            amountPkrFormatted: amount,
            title: input.request.title,
            deepLink,
          })
        : sendApprovalDecisionEmail({
            to: recipient.email,
            recipientName: recipient.fullName,
            decision: input.event === 'approved' ? 'approved' : input.event === 'rejected' ? 'rejected' : 'sent_back',
            type: input.request.approvalType,
            title: input.request.title,
            deepLink,
            comment: input.comment,
          });
    tasks.push(
      send.catch(async (e: unknown) => {
        await db.insert(notifications).values({
          recipientId,
          entityId: input.request.entityId,
          channel: 'email',
          category: `approval.${input.event}`,
          title: tmpl.title,
          body: tmpl.body,
          deepLink,
          failedReason: e instanceof Error ? e.message : String(e),
        });
      }),
    );
  }

  await Promise.all(tasks);
}
