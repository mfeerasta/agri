import { z } from 'zod';

export const documentKindSchema = z.enum([
  'lease_contract',
  'forward_contract',
  'vendor_agreement',
  'employment_contract',
  'board_resolution',
  'power_of_attorney',
  'nda',
  'other',
]);
export type DocumentKind = z.infer<typeof documentKindSchema>;

export const identityVerificationMethodSchema = z.enum([
  'cnic_otp',
  'email_otp',
  'sms_otp',
  'passkey',
  'manual',
]);

export const envelopeStatusSchema = z.enum([
  'draft',
  'sent',
  'partially_signed',
  'completed',
  'declined',
  'expired',
  'voided',
]);

export const signerInputSchema = z.object({
  signingOrder: z.number().int().min(1).max(20),
  signerName: z.string().min(2).max(120),
  signerEmail: z.string().email().optional(),
  signerPhone: z.string().regex(/^(\+?92|0)?3\d{9}$/, 'Invalid Pakistani phone').optional(),
  signerCnic: z.string().regex(/^\d{5}-\d{7}-\d$/, 'Invalid CNIC format').optional(),
  signerRole: z.string().min(2).max(60),
  isZameenUser: z.boolean().default(false),
  zameenUserId: z.string().uuid().optional(),
  identityVerificationMethod: identityVerificationMethodSchema,
}).refine((s) => s.signerEmail || s.signerPhone, {
  message: 'At least one of email or phone is required to deliver the signing link',
});

export const createEnvelopeSchema = z.object({
  entityId: z.string().uuid(),
  title: z.string().min(3).max(200),
  documentKind: documentKindSchema,
  sourceRecordKind: z.string().optional(),
  sourceRecordId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  pdfStorageUrl: z.string().url(),
  pdfSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'sha256 hex required'),
  expiresAt: z.string().datetime().optional(),
  signers: z.array(signerInputSchema).min(1).max(20),
}).refine((d) => {
  const orders = d.signers.map((s) => s.signingOrder);
  return new Set(orders).size === orders.length;
}, { message: 'signing_order must be unique across signers', path: ['signers'] });
export type CreateEnvelopeInput = z.infer<typeof createEnvelopeSchema>;

export const verifyOtpSchema = z.object({
  token: z.string().min(20),
  otpCode: z.string().regex(/^\d{6}$/, '6-digit OTP required'),
});

export const submitSignatureSchema = z.object({
  token: z.string().min(20),
  signatureDataUrl: z.string().startsWith('data:image/png;base64,', 'PNG data URL required'),
  consentTextAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Consent must be explicitly accepted under ETO 2002' }),
  }),
});

export const declineSchema = z.object({
  token: z.string().min(20),
  reason: z.string().min(5).max(500),
});

export const sendReminderSchema = z.object({
  envelopeId: z.string().uuid(),
  signerId: z.string().uuid().optional(),
});

export const voidEnvelopeSchema = z.object({
  envelopeId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});
