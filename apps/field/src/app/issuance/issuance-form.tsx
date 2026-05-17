'use client';
import * as React from 'react';
import { BigButton, Card, CardContent, Input, Label } from '@zameen/ui';

const PURPOSES = [
  { value: 'sowing', label: 'بوائی' },
  { value: 'fertilizer', label: 'کھاد ڈالنا' },
  { value: 'spraying', label: 'سپرے' },
];

export function IssuanceForm() {
  const [purpose, setPurpose] = React.useState('sowing');
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
          resource: 'input_issuances',
          operation: 'insert',
          payload: {
            inputId: fd.get('inputId'),
            fieldId: fd.get('fieldId'),
            quantity: Number(fd.get('quantity')),
            purpose,
            receivedBy: fd.get('receivedBy'),
            issuedOn: new Date().toISOString(),
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
          <div><Label>مال آئی ڈی</Label><Input name="inputId" required /></div>
          <div><Label>کھیت</Label><Input name="fieldId" required /></div>
          <div><Label>مقدار</Label><Input name="quantity" type="number" step="0.01" required /></div>
          <div>
            <Label>مقصد</Label>
            <div className="grid grid-cols-3 gap-2">
              {PURPOSES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setPurpose(p.value)}
                  className={`urdu border border-[var(--rule)] py-3 ${purpose === p.value ? 'bg-[var(--ink)] text-[var(--paper)]' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div><Label>وصول کنندہ</Label><Input name="receivedBy" required /></div>
          <BigButton type="submit" label={busy ? 'محفوظ ہو رہا…' : 'جمع کریں'} tone="success" disabled={busy} />
        </CardContent>
      </Card>
    </form>
  );
}
