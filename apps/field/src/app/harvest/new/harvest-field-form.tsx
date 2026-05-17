'use client';
import * as React from 'react';
import { BigButton, Card, CardContent, Input, Label, UrduInput, WeightInput, AreaInput, PhotoCapture } from '@zameen/ui';

export function HarvestFieldForm() {
  const [acres, setAcres] = React.useState(0);
  const [kg, setKg] = React.useState(0);
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
          resource: 'harvest_records',
          operation: 'insert',
          payload: {
            fieldId: fd.get('fieldId'),
            harvestedOn: fd.get('harvestedOn'),
            acresHarvested: acres,
            grossYieldKg: kg,
            moisturePct: Number(fd.get('moisturePct') || 0),
            notes: fd.get('notes'),
            photoUrls: photos,
          },
        }),
      });
      window.location.href = '/harvest';
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-4">
          <div><Label>کھیت آئی ڈی</Label><Input name="fieldId" required /></div>
          <div><Label>تاریخ</Label><Input type="date" name="harvestedOn" required /></div>
          <div><Label>کٹے ہوئے ایکڑ</Label><AreaInput valueAcres={acres} onChangeAcres={setAcres} /></div>
          <div><Label>کل پیداوار</Label><WeightInput valueKg={kg} onChangeKg={setKg} defaultUnit="mann" /></div>
          <div><Label>نمی فیصد</Label><Input type="number" step="0.1" name="moisturePct" /></div>
          <div><Label>تبصرہ</Label><UrduInput name="notes" /></div>
          <PhotoCapture
            label="تصاویر"
            value={photos}
            onChange={setPhotos}
            uploadFn={async (f) => {
              const fd = new FormData(); fd.append('file', f);
              const r = await fetch('/api/uploads/r2-presign', { method: 'POST', body: fd });
              return (await r.json()).url as string;
            }}
          />
          <BigButton type="submit" label={busy ? 'محفوظ ہو رہا…' : 'محفوظ کریں'} tone="success" disabled={busy} />
        </CardContent>
      </Card>
    </form>
  );
}
