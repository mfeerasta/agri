'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createEnvelope } from '@/modules/signing/actions';

interface EntityOpt {
  id: string;
  name: string;
}

type SignerDraft = {
  signerName: string;
  signerEmail: string;
  signerPhone: string;
  signerCnic: string;
  signerRole: string;
  identityVerificationMethod: 'sms_otp' | 'email_otp' | 'cnic_otp' | 'passkey' | 'manual';
};

const KINDS = [
  'lease_contract',
  'forward_contract',
  'vendor_agreement',
  'employment_contract',
  'board_resolution',
  'power_of_attorney',
  'nda',
  'other',
] as const;

export function NewEnvelopeForm({ entities }: { entities: EntityOpt[] }) {
  const router = useRouter();
  const [entityId, setEntityId] = React.useState(entities[0]?.id ?? '');
  const [title, setTitle] = React.useState('');
  const [documentKind, setDocumentKind] = React.useState<(typeof KINDS)[number]>('lease_contract');
  const [pdfStorageUrl, setPdfStorageUrl] = React.useState('');
  const [pdfSha256, setPdfSha256] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [signers, setSigners] = React.useState<SignerDraft[]>([
    { signerName: '', signerEmail: '', signerPhone: '', signerCnic: '', signerRole: '', identityVerificationMethod: 'sms_otp' },
  ]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onPickPdf(file: File | null) {
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setPdfSha256(hex);
    // upload path is environment-specific; placeholder URL until storage wiring lands.
    setPdfStorageUrl(`zameen://uploads/${encodeURIComponent(file.name)}#${hex.slice(0, 12)}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await createEnvelope({
      entityId,
      title: title.trim(),
      documentKind,
      pdfStorageUrl,
      pdfSha256,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      signers: signers.map((s, i) => ({
        signingOrder: i + 1,
        signerName: s.signerName.trim(),
        signerEmail: s.signerEmail.trim() || undefined,
        signerPhone: s.signerPhone.trim() || undefined,
        signerCnic: s.signerCnic.trim() || undefined,
        signerRole: s.signerRole.trim(),
        isZameenUser: false,
        identityVerificationMethod: s.identityVerificationMethod,
      })),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    router.push(`/app/admin/signing/${res.data.id}`);
  }

  function updateSigner(i: number, patch: Partial<SignerDraft>) {
    setSigners((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="smallcaps text-[0.7rem]">Entity</span>
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="mt-1 w-full border border-[var(--rule)] px-2 py-1.5">
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="smallcaps text-[0.7rem]">Document kind</span>
          <select value={documentKind} onChange={(e) => setDocumentKind(e.target.value as never)} className="mt-1 w-full border border-[var(--rule)] px-2 py-1.5">
            {KINDS.map((k) => (
              <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="smallcaps text-[0.7rem]">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full border border-[var(--rule)] px-2 py-1.5" required />
        </label>
        <label className="text-sm">
          <span className="smallcaps text-[0.7rem]">PDF file</span>
          <input type="file" accept="application/pdf" onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" required />
          {pdfSha256 ? (
            <div className="mt-1 font-mono text-[0.65rem] text-[var(--ink)]/60 break-all">sha256: {pdfSha256}</div>
          ) : null}
        </label>
        <label className="text-sm">
          <span className="smallcaps text-[0.7rem]">Expires (optional)</span>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full border border-[var(--rule)] px-2 py-1.5" />
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="smallcaps text-[0.75rem]">Signers (in order)</h3>
          <button
            type="button"
            onClick={() => setSigners((p) => [...p, { signerName: '', signerEmail: '', signerPhone: '', signerCnic: '', signerRole: '', identityVerificationMethod: 'sms_otp' }])}
            className="smallcaps text-[0.7rem] px-2 py-1 border border-[var(--rule)]"
          >
            Add signer
          </button>
        </div>
        <div className="space-y-3">
          {signers.map((s, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-7 gap-2 border border-[var(--rule)] p-2">
              <div className="md:col-span-1 text-xs flex items-center smallcaps">#{i + 1}</div>
              <input placeholder="Name" value={s.signerName} onChange={(e) => updateSigner(i, { signerName: e.target.value })} className="border border-[var(--rule)] px-2 py-1.5 text-sm md:col-span-2" required />
              <input placeholder="Role (landowner, tenant, etc.)" value={s.signerRole} onChange={(e) => updateSigner(i, { signerRole: e.target.value })} className="border border-[var(--rule)] px-2 py-1.5 text-sm md:col-span-2" required />
              <input placeholder="Email" value={s.signerEmail} onChange={(e) => updateSigner(i, { signerEmail: e.target.value })} className="border border-[var(--rule)] px-2 py-1.5 text-sm md:col-span-1" />
              <input placeholder="03xxxxxxxxx" value={s.signerPhone} onChange={(e) => updateSigner(i, { signerPhone: e.target.value })} className="border border-[var(--rule)] px-2 py-1.5 text-sm md:col-span-1" />
              <input placeholder="CNIC xxxxx-xxxxxxx-x" value={s.signerCnic} onChange={(e) => updateSigner(i, { signerCnic: e.target.value })} className="border border-[var(--rule)] px-2 py-1.5 text-sm md:col-span-2" />
              <select value={s.identityVerificationMethod} onChange={(e) => updateSigner(i, { identityVerificationMethod: e.target.value as never })} className="border border-[var(--rule)] px-2 py-1.5 text-sm md:col-span-2">
                <option value="sms_otp">SMS / WhatsApp OTP</option>
                <option value="email_otp">Email OTP</option>
                <option value="cnic_otp">CNIC + OTP</option>
                <option value="passkey">Passkey</option>
                <option value="manual">Manual (in-person)</option>
              </select>
              {signers.length > 1 ? (
                <button type="button" onClick={() => setSigners((p) => p.filter((_, idx) => idx !== i))} className="smallcaps text-[0.7rem] px-2 py-1 border border-[var(--rule)] md:col-span-1">
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {err ? <div className="text-sm text-red-700">{err}</div> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={busy || !pdfSha256} className="smallcaps text-[0.7rem] px-3 py-2 bg-[var(--ink)] text-[var(--paper)] disabled:opacity-50">
          {busy ? 'Creating...' : 'Create envelope (draft)'}
        </button>
      </div>
    </form>
  );
}
