'use client';
import * as React from 'react';
import { BigButton, Card, CardContent, Input, Label, UrduInput, PhotoCapture } from '@zameen/ui';

const SEVERITIES = [
  { value: 'operational', label: 'معمولی' },
  { value: 'minor', label: 'درمیانہ' },
  { value: 'major', label: 'بڑی' },
  { value: 'breakdown', label: 'خرابی' },
];

export function FieldRepairRequestForm() {
  const [severity, setSeverity] = React.useState('minor');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resource: 'repair_requests',
          operation: 'insert',
          payload: {
            assetId: fd.get('assetId'),
            severity,
            issueDescription: fd.get('issueDescription'),
            issueDescriptionUr: fd.get('issueDescriptionUr'),
            problemPhotoUrls: photos,
          },
        }),
      });
      window.location.href = '/';
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-4">
          <div><Label>سامان آئی ڈی</Label><Input name="assetId" required /></div>
          <div>
            <Label>شدت</Label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`urdu min-h-[64px] border border-[var(--rule)] ${severity === s.value ? 'bg-[var(--rust)] text-[var(--paper)]' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div><Label>خرابی کی تفصیل</Label><UrduInput name="issueDescriptionUr" required /></div>
          <div><Label>English notes</Label><Input name="issueDescription" /></div>
          <PhotoCapture
            label="تصاویر"
            required
            value={photos}
            onChange={setPhotos}
            uploadFn={async (f) => {
              const fd = new FormData(); fd.append('file', f);
              const r = await fetch('/api/uploads/r2-presign', { method: 'POST', body: fd });
              return (await r.json()).url as string;
            }}
          />
          <BigButton type="submit" label={busy ? 'بھیجا جا رہا…' : 'بھیجیں'} tone="warning" disabled={busy} />
        </CardContent>
      </Card>
    </form>
  );
}
