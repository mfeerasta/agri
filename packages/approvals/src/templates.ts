/**
 * Typed registry of approval notification templates. Each template knows how
 * to render itself for each delivery channel (WhatsApp template, email
 * subject + html + text, in-app title + body) in both en and ur.
 *
 * Template parameter slots are addressed by digit only (1, 2, 3...) because
 * Meta WhatsApp Business templates accept only numeric positional parameters.
 */

import type { ApprovalRequest } from '@zameen/db/types';
import { t } from '@zameen/locale';
import type { Locale } from '@zameen/locale';
import { formatPkr, fromRupees } from '@zameen/shared';
import type { NotifyEvent } from './notify.js';

export type TemplateName =
  | 'zameen_approval_request'
  | 'zameen_approval_decision'
  | 'zameen_escalation_reminder'
  | 'zameen_otp';

export interface TemplateRenderInput {
  request: ApprovalRequest;
  event: NotifyEvent;
  locale: Locale;
  decision?: 'approved' | 'rejected' | 'sent_back';
  comment?: string;
  ageHours?: number;
  requesterName?: string;
  entityName?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ApprovalTemplate {
  name: TemplateName;
  whatsappTemplateName: string;
  whatsappParameters(input: TemplateRenderInput): string[];
  emailSubject(input: TemplateRenderInput): string;
  emailBody(input: TemplateRenderInput): { html: string; text: string };
  inAppTitle(input: TemplateRenderInput): string;
  inAppBody(input: TemplateRenderInput): string;
  deepLink(request: ApprovalRequest): string;
}

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';

function approveBase(): string {
  return process.env.NEXT_PUBLIC_APPROVE_URL ?? 'https://approve.agri.feerasta.ai';
}

function deepLinkApproval(request: ApprovalRequest): string {
  return `${approveBase()}/${request.id}`;
}

function deepLinkLogin(): string {
  return `${approveBase()}/login`;
}

function formatAmount(request: ApprovalRequest): string {
  if (!request.amountPkr) return '0';
  return formatPkr(fromRupees(request.amountPkr), 'lac_crore');
}

function localizedTitle(request: ApprovalRequest, locale: Locale): string {
  if (locale === 'ur' && request.titleUr) return request.titleUr;
  return request.title;
}

function decisionVerb(decision: string | undefined, locale: Locale): string {
  switch (decision) {
    case 'approved':
      return t('approval.approved', locale);
    case 'rejected':
      return t('approval.rejected', locale);
    case 'sent_back':
      return locale === 'ur' ? 'واپس بھیجی گئی' : 'sent back';
    default:
      return decision ?? '';
  }
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f5f1ea;font-family:system-ui,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e0d6;">
    <div style="background:${DEEP_GREEN};padding:20px 28px;">
      <div style="font-size:22px;font-weight:700;color:${OCHRE};">Zameen</div>
    </div>
    <div style="padding:28px;line-height:1.55;">${bodyHtml}</div>
    <div style="padding:16px 28px;background:#faf7f1;border-top:1px solid #eee;font-size:12px;color:#666;">
      agri.feerasta.ai
    </div>
  </div>
</body></html>`;
}

function ctaButton(label: string, href: string): string {
  return `<p><a href="${href}" style="display:inline-block;background:${DEEP_GREEN};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">${label}</a></p>`;
}

const approvalRequestTemplate: ApprovalTemplate = {
  name: 'zameen_approval_request',
  whatsappTemplateName: 'zameen_approval_request',
  whatsappParameters(input): string[] {
    const { request, requesterName, entityName } = input;
    return [
      requesterName ?? 'A team member',
      request.approvalType,
      formatAmount(request),
      deepLinkApproval(request),
      entityName ?? 'AGRI',
    ];
  },
  emailSubject(input): string {
    const { request, locale } = input;
    return locale === 'ur'
      ? `منظوری درکار: ${request.approvalType} (${formatAmount(request)})`
      : `Approval needed: ${request.approvalType} (${formatAmount(request)})`;
  },
  emailBody(input): { html: string; text: string } {
    const { request, locale, requesterName } = input;
    const link = deepLinkApproval(request);
    const title = localizedTitle(request, locale);
    const opener = locale === 'ur' ? 'سلام،' : 'Salaam,';
    const intro = locale === 'ur'
      ? `<strong>${requesterName ?? ''}</strong> نے <strong>${request.approvalType}</strong> کی منظوری کے لیے درخواست بھیجی ہے، رقم: <strong>${formatAmount(request)}</strong>۔`
      : `<strong>${requesterName ?? 'A team member'}</strong> has submitted a <strong>${request.approvalType}</strong> approval request for <strong>${formatAmount(request)}</strong>.`;
    const cta = locale === 'ur' ? 'منظوری پی ڈبلیو اے کھولیں' : 'Open in Approver PWA';
    const html = shell(
      this.emailSubject(input),
      `<p>${opener}</p><p>${intro}</p>
       <p style="margin:18px 0;padding:12px 16px;background:#faf7f1;border-left:4px solid ${OCHRE};">${title}</p>
       ${ctaButton(cta, link)}`,
    );
    const text = `${requesterName ?? ''} submitted ${request.approvalType} for ${formatAmount(request)}.\n${title}\nOpen: ${link}`;
    return { html, text };
  },
  inAppTitle(input): string {
    const { request, locale } = input;
    return locale === 'ur'
      ? `${t('approval.pending', 'ur')}: ${request.approvalType}`
      : `Approval needed: ${request.approvalType}`;
  },
  inAppBody(input): string {
    const { request, locale } = input;
    return `${localizedTitle(request, locale)} · ${formatAmount(request)}`;
  },
  deepLink: deepLinkApproval,
};

const approvalDecisionTemplate: ApprovalTemplate = {
  name: 'zameen_approval_decision',
  whatsappTemplateName: 'zameen_approval_decision',
  whatsappParameters(input): string[] {
    const { request, event, decision } = input;
    const final = decision ?? (event === 'approved' ? 'approved' : event === 'rejected' ? 'rejected' : 'sent_back');
    return [final, request.approvalType, formatAmount(request), deepLinkApproval(request)];
  },
  emailSubject(input): string {
    const { request, event, decision, locale } = input;
    const final = decision ?? (event === 'approved' ? 'approved' : event === 'rejected' ? 'rejected' : 'sent_back');
    const verb = decisionVerb(final, locale);
    return locale === 'ur'
      ? `درخواست ${verb}: ${request.approvalType}`
      : `Request ${verb}: ${request.approvalType}`;
  },
  emailBody(input): { html: string; text: string } {
    const { request, event, decision, comment, locale } = input;
    const link = deepLinkApproval(request);
    const final = decision ?? (event === 'approved' ? 'approved' : event === 'rejected' ? 'rejected' : 'sent_back');
    const verb = decisionVerb(final, locale);
    const title = localizedTitle(request, locale);
    const opener = locale === 'ur' ? 'سلام،' : 'Salaam,';
    const intro = locale === 'ur'
      ? `آپ کی <strong>${request.approvalType}</strong> کی درخواست <strong>${verb}</strong> ہو گئی ہے۔`
      : `Your <strong>${request.approvalType}</strong> request was <strong>${verb}</strong>.`;
    const note = comment
      ? (locale === 'ur' ? `<p><em>تبصرہ:</em> ${comment}</p>` : `<p><em>Note:</em> ${comment}</p>`)
      : '';
    const cta = locale === 'ur' ? 'تفصیلات دیکھیں' : 'View details';
    const html = shell(
      this.emailSubject(input),
      `<p>${opener}</p><p>${intro}</p>
       <p style="margin:18px 0;padding:12px 16px;background:#faf7f1;border-left:4px solid ${OCHRE};">${title}</p>
       ${note}
       ${ctaButton(cta, link)}`,
    );
    const text = `Your ${request.approvalType} request was ${verb}.\n${title}\n${comment ?? ''}\nView: ${link}`;
    return { html, text };
  },
  inAppTitle(input): string {
    const { request, event, decision, locale } = input;
    const final = decision ?? (event === 'approved' ? 'approved' : event === 'rejected' ? 'rejected' : 'sent_back');
    const verb = decisionVerb(final, locale);
    return locale === 'ur'
      ? `${verb}: ${request.approvalType}`
      : `Request ${verb}: ${request.approvalType}`;
  },
  inAppBody(input): string {
    return localizedTitle(input.request, input.locale);
  },
  deepLink: deepLinkApproval,
};

const escalationReminderTemplate: ApprovalTemplate = {
  name: 'zameen_escalation_reminder',
  whatsappTemplateName: 'zameen_escalation_reminder',
  whatsappParameters(input): string[] {
    const { request, ageHours } = input;
    return [
      String(Math.max(1, Math.round(ageHours ?? 24))),
      request.approvalType,
      formatAmount(request),
      deepLinkApproval(request),
    ];
  },
  emailSubject(input): string {
    const { request, locale } = input;
    return locale === 'ur'
      ? `یاد دہانی: ${request.approvalType} ابھی تک زیرِ التواء`
      : `Reminder: ${request.approvalType} still pending`;
  },
  emailBody(input): { html: string; text: string } {
    const { request, ageHours, locale } = input;
    const link = deepLinkApproval(request);
    const age = Math.max(1, Math.round(ageHours ?? 24));
    const title = localizedTitle(request, locale);
    const opener = locale === 'ur' ? 'سلام،' : 'Salaam,';
    const intro = locale === 'ur'
      ? `یہ منظوری <strong>${age} گھنٹے</strong> سے زیرِ التواء ہے۔`
      : `This approval has been pending for <strong>${age} hours</strong>.`;
    const cta = locale === 'ur' ? 'ابھی جائزہ لیں' : 'Review now';
    const html = shell(
      this.emailSubject(input),
      `<p>${opener}</p><p>${intro}</p>
       <p style="margin:18px 0;padding:12px 16px;background:#faf7f1;border-left:4px solid ${OCHRE};">${title} · ${formatAmount(request)}</p>
       ${ctaButton(cta, link)}`,
    );
    const text = `Reminder: ${request.approvalType} pending ${age}h. Amount ${formatAmount(request)}.\n${title}\nReview: ${link}`;
    return { html, text };
  },
  inAppTitle(input): string {
    const { request, locale } = input;
    return locale === 'ur'
      ? `یاد دہانی: ${request.approvalType}`
      : `Reminder: ${request.approvalType} pending`;
  },
  inAppBody(input): string {
    const { request, ageHours, locale } = input;
    const age = Math.max(1, Math.round(ageHours ?? 24));
    const ageLabel = locale === 'ur' ? `${age} گھنٹے سے زیرِ التواء` : `Pending for ${age}h`;
    return `${ageLabel} · ${formatAmount(request)}`;
  },
  deepLink: deepLinkApproval,
};

const otpTemplate: ApprovalTemplate = {
  name: 'zameen_otp',
  whatsappTemplateName: 'zameen_otp',
  whatsappParameters(): string[] {
    return [];
  },
  emailSubject(): string {
    return 'Your Zameen login code';
  },
  emailBody(): { html: string; text: string } {
    return { html: shell('OTP', '<p>Your code is displayed in the app.</p>'), text: 'Your Zameen login code' };
  },
  inAppTitle(): string {
    return 'Login code';
  },
  inAppBody(): string {
    return 'Your one-time login code is on the way.';
  },
  deepLink(): string {
    return deepLinkLogin();
  },
};

export const TEMPLATE_REGISTRY: Record<TemplateName, ApprovalTemplate> = {
  zameen_approval_request: approvalRequestTemplate,
  zameen_approval_decision: approvalDecisionTemplate,
  zameen_escalation_reminder: escalationReminderTemplate,
  zameen_otp: otpTemplate,
};

/** Resolve the template to use for a given approval event. */
export function templateForEvent(event: NotifyEvent): ApprovalTemplate {
  switch (event) {
    case 'submitted':
      return approvalRequestTemplate;
    case 'escalation_reminder':
      return escalationReminderTemplate;
    case 'approved':
    case 'rejected':
    case 'sent_back':
      return approvalDecisionTemplate;
  }
}
