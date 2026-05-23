'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  markDocumentStatus,
  renewComplianceDocument,
} from '@/modules/compliance/document-actions';

interface Props {
  docId: string;
  entityId: string;
  docKind: string;
  currentStatus: string;
}

export function RenewActions({ docId, entityId, docKind, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRenew, setShowRenew] = useState(false);
  const [renewUrl, setRenewUrl] = useState('');
  const [renewExpiry, setRenewExpiry] = useState('');
  const [renewTitle, setRenewTitle] = useState('');
  const [renewIssuedOn, setRenewIssuedOn] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/uploads/compliance-document', { method: 'POST', body: fd });
    if (!res.ok) {
      setError('Upload failed');
      return;
    }
    const data = (await res.json()) as { url: string };
    setRenewUrl(data.url);
  }

  function submitRenewal() {
    setError(null);
    if (!renewUrl || !renewTitle) {
      setError('File and title required');
      return;
    }
    startTransition(async () => {
      const res = await renewComplianceDocument(docId, {
        entityId,
        docKind,
        title: renewTitle,
        issuedOn: renewIssuedOn || undefined,
        expiresOn: renewExpiry || undefined,
        storageUrl: renewUrl,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/compliance/documents/${res.id}`);
    });
  }

  function changeStatus(s: 'active' | 'expired' | 'renewing' | 'lost') {
    startTransition(async () => {
      await markDocumentStatus(docId, s);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => setShowRenew((v) => !v)}
        className="border border-[var(--ink)] px-3 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
      >
        {showRenew ? 'Cancel renewal' : 'Renew document'}
      </button>

      {showRenew ? (
        <div className="grid gap-2 border border-[var(--rule)] p-3">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="text-xs"
          />
          <input
            placeholder="New title"
            value={renewTitle}
            onChange={(e) => setRenewTitle(e.target.value)}
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm"
          />
          <label className="text-xs smallcaps">Issued on</label>
          <input
            type="date"
            value={renewIssuedOn}
            onChange={(e) => setRenewIssuedOn(e.target.value)}
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm"
          />
          <label className="text-xs smallcaps">Expires on</label>
          <input
            type="date"
            value={renewExpiry}
            onChange={(e) => setRenewExpiry(e.target.value)}
            className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm"
          />
          {error ? <div className="text-xs text-red-700">{error}</div> : null}
          <button
            type="button"
            disabled={pending}
            onClick={submitRenewal}
            className="border border-[var(--ink)] px-3 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save renewal'}
          </button>
        </div>
      ) : null}

      <div className="flex gap-2 flex-wrap">
        {currentStatus !== 'active' ? (
          <button
            type="button"
            onClick={() => changeStatus('active')}
            disabled={pending}
            className="border border-[var(--ink)] px-2 py-1 smallcaps text-[0.7rem]"
          >
            Mark active
          </button>
        ) : null}
        {currentStatus !== 'renewing' ? (
          <button
            type="button"
            onClick={() => changeStatus('renewing')}
            disabled={pending}
            className="border border-[var(--ink)] px-2 py-1 smallcaps text-[0.7rem]"
          >
            Mark renewing
          </button>
        ) : null}
        {currentStatus !== 'lost' ? (
          <button
            type="button"
            onClick={() => changeStatus('lost')}
            disabled={pending}
            className="border border-[var(--ink)] px-2 py-1 smallcaps text-[0.7rem]"
          >
            Mark lost
          </button>
        ) : null}
      </div>
    </div>
  );
}
