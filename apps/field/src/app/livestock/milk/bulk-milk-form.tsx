'use client';
import * as React from 'react';
import { BigButton, Card, CardContent, Input, Label } from '@zameen/ui';

export function BulkMilkForm() {
  const [rows, setRows] = React.useState<Array<{ animalId: string; morning: number; evening: number }>>([{ animalId: '', morning: 0, evening: 0 }]);
  const [busy, setBusy] = React.useState(false);

  function update(i: number, k: keyof typeof rows[0], v: string) {
    const next = [...rows];
    next[i] = { ...next[i]!, [k]: k === 'animalId' ? v : Number(v) };
    setRows(next);
  }

  async function submit() {
    setBusy(true);
    try {
      for (const r of rows.filter((x) => x.animalId)) {
        if (r.morning > 0) {
          await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resource: 'milk_records', operation: 'insert', payload: { animalId: r.animalId, session: 'morning', litres: r.morning, recordedOn: new Date().toISOString().slice(0, 10) } }) });
        }
        if (r.evening > 0) {
          await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resource: 'milk_records', operation: 'insert', payload: { animalId: r.animalId, session: 'evening', litres: r.evening, recordedOn: new Date().toISOString().slice(0, 10) } }) });
        }
      }
      window.location.href = '/livestock';
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <Input placeholder="کان نمبر" value={r.animalId} onChange={(e) => update(i, 'animalId', e.currentTarget.value)} />
            <Input type="number" step="0.1" placeholder="صبح" value={r.morning || ''} onChange={(e) => update(i, 'morning', e.currentTarget.value)} />
            <Input type="number" step="0.1" placeholder="شام" value={r.evening || ''} onChange={(e) => update(i, 'evening', e.currentTarget.value)} />
          </div>
        ))}
        <button type="button" onClick={() => setRows([...rows, { animalId: '', morning: 0, evening: 0 }])} className="smallcaps text-xs underline">+ Add row</button>
        <BigButton type="button" onClick={submit} label={busy ? 'محفوظ…' : 'جمع کریں'} tone="success" disabled={busy} />
      </CardContent>
    </Card>
  );
}
