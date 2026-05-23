/**
 * Signing notifications: delivery of access link + OTP to signers via
 * email, WhatsApp, and SMS. The actual underlying clients live in
 * sibling modules. Kept thin so the signing engine stays transport-agnostic.
 */

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';

export interface SigningLinkInput {
  to: string;
  signerName: string;
  envelopeTitle: string;
  documentKind: string;
  signUrl: string;
  expiresAt?: string;
}

export function buildSigningEmailHtml(input: SigningLinkInput): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;background:#f5f1ea;font-family:system-ui,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e0d6;">
    <div style="background:${DEEP_GREEN};padding:20px 28px;color:${OCHRE};font-weight:700;font-size:22px;">Zameen</div>
    <div style="padding:28px;line-height:1.55;">
      <p>Salaam ${input.signerName},</p>
      <p>You have a document waiting for your signature.</p>
      <p style="margin:18px 0;padding:12px 16px;background:#faf7f1;border-left:4px solid ${OCHRE};">
        <strong>${input.envelopeTitle}</strong><br/>
        <span style="font-size:13px;color:#666;">Kind: ${input.documentKind.replace(/_/g, ' ')}</span>
      </p>
      <p><a href="${input.signUrl}" style="display:inline-block;background:${DEEP_GREEN};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">Review and sign</a></p>
      ${input.expiresAt ? `<p style="font-size:13px;color:#666;">This link expires on ${input.expiresAt}.</p>` : ''}
      <p style="font-size:12px;color:#888;margin-top:24px;">Signed electronically under the Electronic Transactions Ordinance 2002 (Pakistan).</p>
    </div>
  </div>
</body></html>`;
}

export function buildSigningSmsBody(input: SigningLinkInput): string {
  return `Zameen: ${input.signerName}, please sign "${input.envelopeTitle}". ${input.signUrl}`;
}

export function buildSigningWhatsAppBody(input: SigningLinkInput): string {
  return (
    `*Document to sign*\n` +
    `${input.envelopeTitle}\n\n` +
    `Salaam ${input.signerName}, please review and sign:\n${input.signUrl}\n\n` +
    (input.expiresAt ? `Expires: ${input.expiresAt}\n` : '') +
    `_Signed under ETO 2002._`
  );
}
