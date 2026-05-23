import { loadSignerView } from '@/modules/signing/actions';
import { SignerFlow } from './signer-flow';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicSignPage(props: PageProps) {
  const { token } = await props.params;
  const res = await loadSignerView(token);

  if (!res.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] p-6">
        <div className="max-w-md w-full border border-[var(--rule)] p-6 bg-white">
          <h1 className="text-lg font-semibold mb-2">Cannot open document</h1>
          <p className="text-sm text-[var(--ink)]/70">{res.error}</p>
          <p className="text-xs text-[var(--ink)]/50 mt-4">
            If you believe this link is still valid, contact the sender.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] py-6 px-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60">Zameen E-Signing</div>
            <div className="text-lg font-semibold">{res.envelope.title}</div>
            <div className="text-xs text-[var(--ink)]/60">
              Envelope {res.envelope.envelopeNumber} · {res.envelope.documentKind.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="smallcaps text-[0.7rem]">{res.signer.status}</div>
        </div>

        <SignerFlow
          token={token}
          signerName={res.signer.signerName}
          signerRole={res.signer.signerRole}
          signerStatus={res.signer.status}
          eligibleNow={res.eligibleNow}
          pdfStorageUrl={res.envelope.pdfStorageUrl}
          pdfSha256={res.envelope.pdfSha256}
          envelopeNumber={res.envelope.envelopeNumber}
          identityVerificationMethod={res.signer.identityVerificationMethod ?? 'sms_otp'}
          identityVerified={!!res.signer.identityVerifiedAt}
        />
      </div>
    </div>
  );
}
