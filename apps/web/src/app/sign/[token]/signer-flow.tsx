'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SignatureCanvas, type SignatureCanvasHandle } from '@zameen/ui';
import { requestSignerOtp, verifyOtp, submitSignature, declineSignature } from '@/modules/signing/actions';

const CONSENT_EN =
  'I confirm that I am the named signatory. I consent under section 7 of the Electronic ' +
  'Transactions Ordinance 2002 to sign this document electronically. I acknowledge that my ' +
  'electronic signature is uniquely linked to me, that I am in sole control of the signing ' +
  'process, and that any subsequent alteration to the signed document will be detectable via ' +
  'cryptographic hash.';

const CONSENT_UR =
  'میں تصدیق کرتا/کرتی ہوں کہ میں ہی نامزد دستخط کنندہ ہوں۔ میں الیکٹرانک ٹرانزیکشنز آرڈیننس ' +
  '2002 کی دفعہ 7 کے تحت اس دستاویز پر الیکٹرانک طور پر دستخط کرنے کی رضامندی دیتا/دیتی ہوں۔';

interface Props {
  token: string;
  signerName: string;
  signerRole: string;
  signerStatus: string;
  eligibleNow: boolean;
  pdfStorageUrl: string;
  pdfSha256: string;
  envelopeNumber: string;
  identityVerificationMethod: string;
  identityVerified: boolean;
}

type Step = 'identity' | 'review' | 'sign' | 'done';

export function SignerFlow(props: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(
    props.signerStatus === 'signed' ? 'done' : props.identityVerified ? 'review' : 'identity',
  );
  const [otp, setOtp] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  const [consentAccepted, setConsentAccepted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const sigRef = React.useRef<SignatureCanvasHandle>(null);

  async function doRequestOtp() {
    setBusy(true);
    setErr(null);
    const r = await requestSignerOtp(props.token);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setOtpSent(true);
  }

  async function doVerify() {
    setBusy(true);
    setErr(null);
    const r = await verifyOtp({ token: props.token, otpCode: otp });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setStep('review');
  }

  async function doSubmit() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setErr('Please draw your signature before submitting.');
      return;
    }
    const dataUrl = sigRef.current.toDataURL();
    setBusy(true);
    setErr(null);
    const r = await submitSignature({
      token: props.token,
      signatureDataUrl: dataUrl,
      consentTextAccepted: true,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setStep('done');
    router.refresh();
  }

  async function doDecline() {
    const reason = window.prompt('Reason for declining? (required, minimum 5 characters)');
    if (!reason || reason.length < 5) return;
    setBusy(true);
    const r = await declineSignature({ token: props.token, reason });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setStep('done');
    router.refresh();
  }

  if (!props.eligibleNow && step !== 'done') {
    return (
      <div className="border border-[var(--rule)] p-6 bg-white">
        <h2 className="text-base font-semibold mb-1">Waiting for prior signers</h2>
        <p className="text-sm text-[var(--ink)]/70">
          This envelope is signed in order. You will be able to sign once the earlier signers have completed their part.
        </p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="border border-[var(--rule)] p-6 bg-white">
        <h2 className="text-base font-semibold mb-1">Thank you</h2>
        <p className="text-sm text-[var(--ink)]/70">
          Your signature has been recorded against envelope {props.envelopeNumber}. You may close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-[var(--rule)] p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">Signer</div>
            <div className="font-medium">{props.signerName} <span className="text-[var(--ink)]/60 text-sm">({props.signerRole})</span></div>
          </div>
          <div className="text-[0.7rem] text-[var(--ink)]/50">Verification: {props.identityVerificationMethod.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {step === 'identity' ? (
        <div className="border border-[var(--rule)] p-4 bg-white space-y-3">
          <h2 className="text-base font-semibold">Verify your identity</h2>
          <p className="text-sm text-[var(--ink)]/70">
            We will send a one-time code to your registered contact. Enter it below to continue.
          </p>
          {!otpSent ? (
            <button onClick={doRequestOtp} disabled={busy} className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)] disabled:opacity-50">
              {busy ? 'Sending...' : 'Send code'}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="border border-[var(--rule)] px-3 py-2 text-lg font-mono w-40"
              />
              <div className="flex gap-2">
                <button onClick={doVerify} disabled={busy || otp.length !== 6} className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)] disabled:opacity-50">
                  Verify
                </button>
                <button onClick={doRequestOtp} disabled={busy} className="smallcaps text-[0.7rem] px-3 py-2 border border-[var(--rule)]">
                  Resend
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {step === 'review' ? (
        <div className="border border-[var(--rule)] p-4 bg-white space-y-3">
          <h2 className="text-base font-semibold">Review the document</h2>
          <div className="border border-[var(--rule)] bg-[var(--paper-2)] p-3 text-xs">
            <div className="font-mono break-all">{props.pdfStorageUrl}</div>
            <div className="mt-1 text-[var(--ink)]/60">sha256: <span className="font-mono">{props.pdfSha256}</span></div>
          </div>
          <a href={props.pdfStorageUrl} target="_blank" rel="noreferrer" className="inline-block smallcaps text-[0.7rem] px-3 py-2 border border-[var(--rule)]">
            Open PDF in new tab
          </a>
          <div className="pt-2">
            <button onClick={() => setStep('sign')} className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)]">
              I have read the document — proceed
            </button>
          </div>
        </div>
      ) : null}

      {step === 'sign' ? (
        <div className="border border-[var(--rule)] p-4 bg-white space-y-3">
          <h2 className="text-base font-semibold">Sign</h2>
          <div className="text-xs space-y-1">
            <p>{CONSENT_EN}</p>
            <p dir="rtl" className="font-[Noto_Naskh_Arabic]">{CONSENT_UR}</p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} />
            <span>I accept the consent above and confirm I am the named signatory.</span>
          </label>
          <div>
            <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60 mb-1">Draw your signature</div>
            <SignatureCanvas ref={sigRef} />
            <button type="button" onClick={() => sigRef.current?.clear()} className="mt-1 smallcaps text-[0.7rem] px-2 py-1 border border-[var(--rule)]">
              Clear
            </button>
          </div>
          {err ? <div className="text-sm text-red-700">{err}</div> : null}
          <div className="flex gap-2">
            <button onClick={doSubmit} disabled={busy || !consentAccepted} className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)] disabled:opacity-50">
              {busy ? 'Submitting...' : 'Submit signature'}
            </button>
            <button onClick={doDecline} disabled={busy} className="smallcaps text-[0.7rem] px-3 py-2 border border-[var(--rule)] text-red-700">
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {err && step !== 'sign' ? <div className="text-sm text-red-700">{err}</div> : null}

      <div className="text-[0.65rem] text-[var(--ink)]/50 text-center pt-2">
        Envelope {props.envelopeNumber} · ETO 2002 compliant · agri.feerasta.ai
      </div>
    </div>
  );
}
