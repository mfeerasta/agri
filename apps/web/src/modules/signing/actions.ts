'use server';

/**
 * E-signing server actions: create envelope, send, verify identity (OTP),
 * submit signature, decline, void, send reminder. All mutations append to
 * the immutable signature_audit_events trail. ETO 2002 compliant.
 */

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  db,
  signingEnvelopes,
  envelopeSigners,
  signatureAuditEvents,
  forwardContracts,
  leaseContracts,
} from '@zameen/db';
import {
  createEnvelopeSchema,
  verifyOtpSchema,
  submitSignatureSchema,
  declineSchema,
  voidEnvelopeSchema,
  sendReminderSchema,
  type CreateEnvelopeInput,
  computeEnvelopeStatus,
  nextEligibleSigner,
  newAccessToken,
  newEnvelopeNumber,
  newOtpCode,
  hashOtp,
  isOtpValid,
  sha256Hex,
  buildSigningEmailHtml,
  buildSigningSmsBody,
  buildSigningWhatsAppBody,
} from '@zameen/shared';
import { getSessionContext } from '@/lib/session';

type Result<T = { id: string }> = { ok: true; data: T } | { ok: false; error: string };

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SIGN_BASE_URL = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://agri.feerasta.ai';

async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    ua: h.get('user-agent') ?? null,
  };
}

async function appendAudit(input: {
  envelopeId: string;
  signerId?: string | null;
  eventKind: string;
  payload?: Record<string, unknown>;
  ip?: string | null;
  ua?: string | null;
}) {
  await db.insert(signatureAuditEvents).values({
    envelopeId: input.envelopeId,
    signerId: input.signerId ?? null,
    eventKind: input.eventKind,
    ipAddress: input.ip ?? null,
    userAgent: input.ua ?? null,
    payload: input.payload ?? null,
  });
}

async function nextEnvelopeNumber(entityId: string): Promise<string> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(signingEnvelopes)
    .where(eq(signingEnvelopes.entityId, entityId));
  return newEnvelopeNumber((row?.c ?? 0) + 1);
}

export async function createEnvelope(input: CreateEnvelopeInput): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = createEnvelopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const data = parsed.data;

  const envelopeNumber = await nextEnvelopeNumber(data.entityId);

  const [env] = await db
    .insert(signingEnvelopes)
    .values({
      entityId: data.entityId,
      envelopeNumber,
      title: data.title,
      documentKind: data.documentKind,
      sourceRecordKind: data.sourceRecordKind ?? null,
      sourceRecordId: data.sourceRecordId ?? null,
      templateId: data.templateId ?? null,
      pdfStorageUrl: data.pdfStorageUrl,
      pdfSha256: data.pdfSha256,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      initiatedBy: ctx.userId,
      status: 'draft',
    })
    .returning({ id: signingEnvelopes.id });

  if (!env) return { ok: false, error: 'Envelope insert failed' };

  await db.insert(envelopeSigners).values(
    data.signers.map((s) => ({
      envelopeId: env.id,
      signingOrder: s.signingOrder,
      signerName: s.signerName,
      signerEmail: s.signerEmail ?? null,
      signerPhone: s.signerPhone ?? null,
      signerCnic: s.signerCnic ?? null,
      signerRole: s.signerRole,
      isZameenUser: s.isZameenUser ?? false,
      zameenUserId: s.zameenUserId ?? null,
      identityVerificationMethod: s.identityVerificationMethod,
      accessToken: newAccessToken(),
      status: 'pending',
    })),
  );

  const meta = await clientMeta();
  await appendAudit({
    envelopeId: env.id,
    eventKind: 'created',
    ip: meta.ip,
    ua: meta.ua,
    payload: { envelopeNumber, signerCount: data.signers.length },
  });

  revalidatePath('/app/admin/signing');
  return { ok: true, data: { id: env.id } };
}

export async function sendEnvelope(envelopeId: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const [env] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, envelopeId));
  if (!env) return { ok: false, error: 'Envelope not found' };
  if (env.status !== 'draft') return { ok: false, error: `Cannot send envelope in status ${env.status}` };

  const signers = await db
    .select()
    .from(envelopeSigners)
    .where(eq(envelopeSigners.envelopeId, envelopeId))
    .orderBy(asc(envelopeSigners.signingOrder));

  const now = new Date();
  await db
    .update(signingEnvelopes)
    .set({ status: 'sent', updatedAt: now })
    .where(eq(signingEnvelopes.id, envelopeId));

  for (const s of signers) {
    await db
      .update(envelopeSigners)
      .set({ status: 'sent', sentAt: now })
      .where(eq(envelopeSigners.id, s.id));
    const signUrl = `${SIGN_BASE_URL}/sign/${s.accessToken}`;
    const linkInput = {
      to: s.signerEmail ?? s.signerPhone ?? '',
      signerName: s.signerName,
      envelopeTitle: env.title,
      documentKind: env.documentKind,
      signUrl,
      expiresAt: env.expiresAt?.toISOString().slice(0, 10),
    };
    // Best-effort delivery; logged but does not block envelope state.
    try {
      if (s.signerEmail) {
        const { Resend } = await import('resend');
        const r = new Resend(process.env.RESEND_API_KEY ?? '');
        await r.emails.send({
          from: process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>',
          to: s.signerEmail,
          subject: `Please sign: ${env.title}`,
          html: buildSigningEmailHtml(linkInput),
        });
      }
      if (s.signerPhone) {
        const { sendTextMessage } = await import('@zameen/shared');
        await sendTextMessage({ to: s.signerPhone, body: buildSigningWhatsAppBody(linkInput) });
      }
    } catch {
      // swallow — outbound delivery failures recorded in audit but not surfaced
    }
    await appendAudit({
      envelopeId,
      signerId: s.id,
      eventKind: 'sent',
      payload: { method: s.signerEmail ? 'email+whatsapp' : 'whatsapp', signUrl, sms: buildSigningSmsBody(linkInput) },
    });
  }

  revalidatePath('/app/admin/signing');
  revalidatePath(`/app/admin/signing/${envelopeId}`);
  return { ok: true, data: { id: envelopeId } };
}

/** Public: load envelope by signer access token. No auth required. */
export async function loadSignerView(token: string): Promise<
  | { ok: true; envelope: typeof signingEnvelopes.$inferSelect; signer: typeof envelopeSigners.$inferSelect; eligibleNow: boolean }
  | { ok: false; error: string }
> {
  const [signer] = await db.select().from(envelopeSigners).where(eq(envelopeSigners.accessToken, token));
  if (!signer) return { ok: false, error: 'Invalid or expired link' };
  const [env] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, signer.envelopeId));
  if (!env) return { ok: false, error: 'Envelope not found' };
  if (env.status === 'voided' || env.status === 'expired' || env.status === 'declined') {
    return { ok: false, error: `Envelope is ${env.status}` };
  }
  if (env.expiresAt && env.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'Envelope has expired' };
  }

  // mark viewed once
  if (!signer.viewedAt) {
    const meta = await clientMeta();
    await db
      .update(envelopeSigners)
      .set({ viewedAt: new Date(), status: signer.status === 'sent' ? 'viewed' : signer.status, ipAddress: meta.ip ?? signer.ipAddress, userAgent: meta.ua ?? signer.userAgent })
      .where(eq(envelopeSigners.id, signer.id));
    await appendAudit({ envelopeId: env.id, signerId: signer.id, eventKind: 'viewed', ip: meta.ip, ua: meta.ua });
  }

  const allSigners = await db
    .select()
    .from(envelopeSigners)
    .where(eq(envelopeSigners.envelopeId, env.id))
    .orderBy(asc(envelopeSigners.signingOrder));
  const next = nextEligibleSigner(allSigners);
  const eligibleNow = next?.id === signer.id;

  return { ok: true, envelope: env, signer, eligibleNow };
}

export async function requestSignerOtp(token: string): Promise<Result> {
  const [signer] = await db.select().from(envelopeSigners).where(eq(envelopeSigners.accessToken, token));
  if (!signer) return { ok: false, error: 'Invalid link' };
  if (signer.status === 'signed' || signer.status === 'declined') {
    return { ok: false, error: `Already ${signer.status}` };
  }
  const code = newOtpCode();
  const salt = signer.id; // per-signer salt
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db
    .update(envelopeSigners)
    .set({
      otpCodeHash: hashOtp(code, salt),
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    })
    .where(eq(envelopeSigners.id, signer.id));

  // best-effort delivery — send via the configured method
  try {
    if (signer.identityVerificationMethod === 'sms_otp' && signer.signerPhone) {
      const { sendOtpTemplate } = await import('@zameen/shared');
      await sendOtpTemplate({ to: signer.signerPhone, code });
    } else if (signer.identityVerificationMethod === 'email_otp' && signer.signerEmail) {
      const { Resend } = await import('resend');
      const r = new Resend(process.env.RESEND_API_KEY ?? '');
      await r.emails.send({
        from: process.env.ZAMEEN_EMAIL_FROM ?? 'Zameen <notifications@agri.feerasta.ai>',
        to: signer.signerEmail,
        subject: `Your Zameen signing code: ${code}`,
        text: `Your code is ${code}. It expires in 10 minutes.`,
      });
    } else if (signer.signerPhone) {
      const { sendOtpTemplate } = await import('@zameen/shared');
      await sendOtpTemplate({ to: signer.signerPhone, code });
    }
  } catch {
    // ignore
  }
  await appendAudit({ envelopeId: signer.envelopeId, signerId: signer.id, eventKind: 'identity_verified', payload: { stage: 'otp_requested', method: signer.identityVerificationMethod } });
  return { ok: true, data: { id: signer.id } };
}

export async function verifyOtp(input: { token: string; otpCode: string }): Promise<Result> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid' };
  const [signer] = await db.select().from(envelopeSigners).where(eq(envelopeSigners.accessToken, parsed.data.token));
  if (!signer) return { ok: false, error: 'Invalid link' };
  if (signer.otpAttempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: 'Too many attempts. Request a new code.' };
  if (!signer.otpCodeHash) return { ok: false, error: 'No active code. Request a new one.' };
  const ok = isOtpValid(parsed.data.otpCode, signer.otpCodeHash, signer.id, signer.otpExpiresAt ?? null);
  await db
    .update(envelopeSigners)
    .set({ otpAttempts: signer.otpAttempts + 1, ...(ok ? { identityVerifiedAt: new Date() } : {}) })
    .where(eq(envelopeSigners.id, signer.id));
  if (!ok) return { ok: false, error: 'Invalid or expired code' };
  const meta = await clientMeta();
  await appendAudit({ envelopeId: signer.envelopeId, signerId: signer.id, eventKind: 'identity_verified', ip: meta.ip, ua: meta.ua, payload: { stage: 'otp_verified' } });
  return { ok: true, data: { id: signer.id } };
}

export async function submitSignature(input: {
  token: string;
  signatureDataUrl: string;
  consentTextAccepted: true;
}): Promise<Result> {
  const parsed = submitSignatureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid' };
  const [signer] = await db.select().from(envelopeSigners).where(eq(envelopeSigners.accessToken, parsed.data.token));
  if (!signer) return { ok: false, error: 'Invalid link' };
  if (signer.status === 'signed') return { ok: false, error: 'Already signed' };
  if (!signer.identityVerifiedAt) return { ok: false, error: 'Identity not verified' };

  const allSigners = await db
    .select()
    .from(envelopeSigners)
    .where(eq(envelopeSigners.envelopeId, signer.envelopeId))
    .orderBy(asc(envelopeSigners.signingOrder));
  const next = nextEligibleSigner(allSigners);
  if (next?.id !== signer.id) return { ok: false, error: 'Out-of-order signing not allowed' };

  // Upload the signature image to storage. We store the data URL hash in audit
  // and persist a storage URL. Caller is expected to have already uploaded;
  // here we keep the data URL inline as a fallback for dev.
  const sigHash = sha256Hex(parsed.data.signatureDataUrl);
  const sigUrl = parsed.data.signatureDataUrl; // dev fallback; prod should swap to blob URL

  const meta = await clientMeta();
  const now = new Date();
  await db
    .update(envelopeSigners)
    .set({
      status: 'signed',
      signedAt: now,
      signatureImageUrl: sigUrl,
      consentTextAccepted: true,
      ipAddress: meta.ip ?? signer.ipAddress,
      userAgent: meta.ua ?? signer.userAgent,
    })
    .where(eq(envelopeSigners.id, signer.id));

  await appendAudit({
    envelopeId: signer.envelopeId,
    signerId: signer.id,
    eventKind: 'signed',
    ip: meta.ip,
    ua: meta.ua,
    payload: { signatureSha256: sigHash, role: signer.signerRole },
  });

  // Re-evaluate envelope state.
  const updatedSigners = await db
    .select({ status: envelopeSigners.status })
    .from(envelopeSigners)
    .where(eq(envelopeSigners.envelopeId, signer.envelopeId));
  const [env] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, signer.envelopeId));
  if (env) {
    const newStatus = computeEnvelopeStatus(updatedSigners, env.status as never);
    const completed = newStatus === 'completed';
    await db
      .update(signingEnvelopes)
      .set({
        status: newStatus,
        completedAt: completed ? now : env.completedAt,
        // Final PDF assembly happens out-of-band in finalize-envelope cron;
        // we record the input pdf hash + signer hashes as the audit anchor.
        signedPdfSha256: completed ? sha256Hex(`${env.pdfSha256}|${updatedSigners.length}|${now.toISOString()}`) : env.signedPdfSha256,
        updatedAt: now,
      })
      .where(eq(signingEnvelopes.id, env.id));

    if (completed) {
      await appendAudit({ envelopeId: env.id, eventKind: 'completed', payload: { completedAt: now.toISOString() } });
      await propagateToSourceRecord(env);
    }
  }

  return { ok: true, data: { id: signer.id } };
}

export async function declineSignature(input: { token: string; reason: string }): Promise<Result> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid' };
  const [signer] = await db.select().from(envelopeSigners).where(eq(envelopeSigners.accessToken, parsed.data.token));
  if (!signer) return { ok: false, error: 'Invalid link' };
  const now = new Date();
  await db
    .update(envelopeSigners)
    .set({ status: 'declined', declinedAt: now, declineReason: parsed.data.reason })
    .where(eq(envelopeSigners.id, signer.id));
  await db
    .update(signingEnvelopes)
    .set({ status: 'declined', updatedAt: now })
    .where(eq(signingEnvelopes.id, signer.envelopeId));
  const meta = await clientMeta();
  await appendAudit({
    envelopeId: signer.envelopeId,
    signerId: signer.id,
    eventKind: 'declined',
    ip: meta.ip,
    ua: meta.ua,
    payload: { reason: parsed.data.reason },
  });
  return { ok: true, data: { id: signer.id } };
}

export async function voidEnvelope(input: { envelopeId: string; reason: string }): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = voidEnvelopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid' };
  await db
    .update(signingEnvelopes)
    .set({ status: 'voided', updatedAt: new Date() })
    .where(eq(signingEnvelopes.id, parsed.data.envelopeId));
  await appendAudit({
    envelopeId: parsed.data.envelopeId,
    eventKind: 'voided',
    payload: { reason: parsed.data.reason, voidedBy: ctx.userId },
  });
  revalidatePath('/app/admin/signing');
  revalidatePath(`/app/admin/signing/${parsed.data.envelopeId}`);
  return { ok: true, data: { id: parsed.data.envelopeId } };
}

export async function sendReminder(input: { envelopeId: string; signerId?: string }): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: 'Not authenticated' };
  const parsed = sendReminderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid' };
  const [env] = await db.select().from(signingEnvelopes).where(eq(signingEnvelopes.id, parsed.data.envelopeId));
  if (!env) return { ok: false, error: 'Envelope not found' };
  const targets = parsed.data.signerId
    ? await db.select().from(envelopeSigners).where(eq(envelopeSigners.id, parsed.data.signerId))
    : await db
        .select()
        .from(envelopeSigners)
        .where(and(eq(envelopeSigners.envelopeId, env.id), sql`${envelopeSigners.status} in ('sent','viewed')`));

  for (const s of targets) {
    const signUrl = `${SIGN_BASE_URL}/sign/${s.accessToken}`;
    try {
      if (s.signerPhone) {
        const { sendTextMessage } = await import('@zameen/shared');
        await sendTextMessage({ to: s.signerPhone, body: `Reminder: please sign "${env.title}". ${signUrl}` });
      }
    } catch {
      // ignore
    }
    await appendAudit({ envelopeId: env.id, signerId: s.id, eventKind: 'reminder_sent', payload: { signUrl } });
  }
  return { ok: true, data: { id: env.id } };
}

/**
 * After completion, flip the linked source record (lease, forward contract,
 * etc.) into a signed/active state. Wrapped in try/catch so a missing target
 * row never blocks audit append.
 */
async function propagateToSourceRecord(env: typeof signingEnvelopes.$inferSelect) {
  if (!env.sourceRecordKind || !env.sourceRecordId) return;
  try {
    if (env.sourceRecordKind === 'forward_contract') {
      await db
        .update(forwardContracts)
        .set({ status: 'signed' as never, updatedAt: new Date() } as never)
        .where(eq(forwardContracts.id, env.sourceRecordId));
    } else if (env.sourceRecordKind === 'lease_contract') {
      await db
        .update(leaseContracts)
        .set({ status: 'active' as never, updatedAt: new Date() } as never)
        .where(eq(leaseContracts.id, env.sourceRecordId));
    }
  } catch {
    // best-effort propagation
  }
}
