'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { createComplianceDocument } from '@/modules/compliance/document-actions';

interface Props {
  entities: Array<{ id: string; name: string }>;
  docKinds: string[];
}

interface ExtractedFields {
  docKind?: string;
  title?: string;
  referenceNumber?: string;
  issuingAuthority?: string;
  issuedOn?: string;
  expiresOn?: string;
}

export function UploadDocumentForm({ entities, docKinds }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [storageUrl, setStorageUrl] = useState('');
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    entityId: entities[0]?.id ?? '',
    docKind: 'land_record_fard',
    title: '',
    referenceNumber: '',
    issuingAuthority: '',
    issuedOn: '',
    expiresOn: '',
    notes: '',
  });

  async function handleFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const upRes = await fetch('/api/uploads/compliance-document', { method: 'POST', body: fd });
    if (!upRes.ok) {
      setError('Upload failed');
      return;
    }
    const up = (await upRes.json()) as { url: string };
    setStorageUrl(up.url);

    setExtracting(true);
    try {
      const ocrRes = await fetch('/api/ai/extract-compliance-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: up.url }),
      });
      if (ocrRes.ok) {
        const ex = (await ocrRes.json()) as ExtractedFields;
        setExtracted(ex);
        setForm((f) => ({
          ...f,
          docKind: ex.docKind && docKinds.includes(ex.docKind) ? ex.docKind : f.docKind,
          title: ex.title ?? f.title,
          referenceNumber: ex.referenceNumber ?? f.referenceNumber,
          issuingAuthority: ex.issuingAuthority ?? f.issuingAuthority,
          issuedOn: ex.issuedOn ?? f.issuedOn,
          expiresOn: ex.expiresOn ?? f.expiresOn,
        }));
      }
    } finally {
      setExtracting(false);
    }
  }

  function submit() {
    setError(null);
    if (!storageUrl) {
      setError('Upload a file first');
      return;
    }
    if (!form.title) {
      setError('Title required');
      return;
    }
    startTransition(async () => {
      const res = await createComplianceDocument({
        entityId: form.entityId,
        docKind: form.docKind,
        title: form.title,
        referenceNumber: form.referenceNumber || undefined,
        issuingAuthority: form.issuingAuthority || undefined,
        issuedOn: form.issuedOn || undefined,
        expiresOn: form.expiresOn || undefined,
        storageUrl,
        notes: form.notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/compliance/documents/${res.id}`);
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>File</CardTitle>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="file"
            className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--rule)] p-8 cursor-pointer hover:bg-[var(--paper-2)]"
          >
            <span className="smallcaps text-xs text-[var(--ink)]/60">
              {storageUrl ? 'Replace file' : 'Drag & drop or click to upload (PDF / JPG / PNG)'}
            </span>
            <input
              id="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
          {storageUrl ? (
            <div className="mt-2 text-xs">
              Uploaded: <a className="underline" href={storageUrl} target="_blank" rel="noreferrer">view</a>
            </div>
          ) : null}
          {extracting ? <div className="mt-2 text-xs smallcaps">Extracting with Claude vision…</div> : null}
          {extracted ? (
            <div className="mt-2 text-xs text-[var(--ink)]/60">
              Prefilled from OCR. Review and correct before saving.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Entity">
            <select
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.entityId}
              onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value }))}
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Document kind">
            <select
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.docKind}
              onChange={(e) => setForm((f) => ({ ...f, docKind: e.target.value }))}
            >
              {docKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <Field label="Reference number">
            <input
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.referenceNumber}
              onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
            />
          </Field>
          <Field label="Issuing authority">
            <input
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              value={form.issuingAuthority}
              onChange={(e) => setForm((f) => ({ ...f, issuingAuthority: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued on">
              <input
                type="date"
                className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
                value={form.issuedOn}
                onChange={(e) => setForm((f) => ({ ...f, issuedOn: e.target.value }))}
              />
            </Field>
            <Field label="Expires on">
              <input
                type="date"
                className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
                value={form.expiresOn}
                onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-sm w-full"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save document'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70 mb-1">{label}</div>
      {children}
    </label>
  );
}
