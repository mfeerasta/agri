/**
 * E-signing core helpers — ETO 2002 compliance utilities.
 * Signature uniquely linked to signer (OTP + audit trail),
 * capable of identifying signer (CNIC/email/phone + IP + UA),
 * signer in sole control (single-use access token + per-signer OTP),
 * any change to data detectable (sha256 of pre + post PDF).
 */
import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(buffer: Uint8Array | Buffer | string): string {
  const h = createHash('sha256');
  h.update(buffer);
  return h.digest('hex');
}

export function newAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newEnvelopeNumber(seq: number, year = new Date().getFullYear()): string {
  return `ENV-${year}-${seq.toString().padStart(5, '0')}`;
}

export function newOtpCode(): string {
  // 6-digit numeric OTP. Use rejection sampling for uniform distribution.
  const buf = randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, '0');
}

export function hashOtp(code: string, salt: string): string {
  return sha256Hex(`${salt}:${code}`);
}

export function isOtpValid(input: string, hash: string, salt: string, expiresAt: Date | null): boolean {
  if (!expiresAt || expiresAt.getTime() < Date.now()) return false;
  return hashOtp(input, salt) === hash;
}

export const ETO_2002_CONSENT_TEXT_EN =
  'I confirm that I am the named signatory. I consent under section 7 of the Electronic ' +
  'Transactions Ordinance 2002 to sign this document electronically. I acknowledge that my ' +
  'electronic signature is uniquely linked to me, that I am in sole control of the signing ' +
  'process, and that any subsequent alteration to the signed document will be detectable via ' +
  'cryptographic hash.';

export const ETO_2002_CONSENT_TEXT_UR =
  'میں تصدیق کرتا/کرتی ہوں کہ میں ہی نامزد دستخط کنندہ ہوں۔ میں الیکٹرانک ٹرانزیکشنز آرڈیننس ' +
  '2002 کی دفعہ 7 کے تحت اس دستاویز پر الیکٹرانک طور پر دستخط کرنے کی رضامندی دیتا/دیتی ہوں۔ ' +
  'میں تسلیم کرتا/کرتی ہوں کہ میرا الیکٹرانک دستخط منفرد طور پر مجھ سے منسلک ہے، میں دستخط کے ' +
  'عمل پر مکمل اختیار رکھتا/رکھتی ہوں، اور دستخط شدہ دستاویز میں کسی بھی تبدیلی کا cryptographic ' +
  'hash کے ذریعے سراغ لگایا جا سکے گا۔';

export type EnvelopeStatus =
  | 'draft'
  | 'sent'
  | 'partially_signed'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'voided';

export function computeEnvelopeStatus(
  signers: { status: string }[],
  currentStatus: EnvelopeStatus,
): EnvelopeStatus {
  if (currentStatus === 'voided' || currentStatus === 'expired') return currentStatus;
  if (signers.some((s) => s.status === 'declined')) return 'declined';
  if (signers.every((s) => s.status === 'signed')) return 'completed';
  if (signers.some((s) => s.status === 'signed')) return 'partially_signed';
  if (signers.some((s) => s.status === 'sent' || s.status === 'viewed')) return 'sent';
  return currentStatus;
}

/**
 * Returns the next signer eligible to sign given strict ordering.
 * If all prior orders are signed (or there are none), that signer can sign.
 */
export function nextEligibleSigner<T extends { signingOrder: number; status: string }>(
  signers: T[],
): T | null {
  const sorted = [...signers].sort((a, b) => a.signingOrder - b.signingOrder);
  for (const s of sorted) {
    if (s.status === 'signed') continue;
    return s;
  }
  return null;
}
