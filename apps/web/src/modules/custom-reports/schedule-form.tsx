'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@zameen/ui';
import { scheduleReport } from './actions';

type DeliveryFormat = 'email_pdf' | 'email_xlsx' | 'whatsapp_summary' | 'dashboard_embed';

export function ScheduleForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [recipient, setRecipient] = React.useState('');
  const [kind, setKind] = React.useState<'email' | 'whatsapp' | 'user'>('email');
  const [format, setFormat] = React.useState<DeliveryFormat>('email_pdf');
  const [cron, setCron] = React.useState('0 7 * * 1');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await scheduleReport({
      reportId,
      recipients: [{ kind, value: recipient }],
      deliveryFormat: format,
      scheduleCron: cron,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    router.push(`/reports/${reportId}` as never);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Schedule delivery</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-xs smallcaps">Recipient</label>
        <div className="flex gap-1">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="rounded border border-[var(--border)] bg-[var(--bg)] px-1 text-xs"
          >
            <option value="email">email</option>
            <option value="whatsapp">whatsapp</option>
            <option value="user">user</option>
          </select>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="address or user id"
            className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs"
          />
        </div>
        <label className="block text-xs smallcaps">Format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as DeliveryFormat)}
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-1 text-xs"
        >
          <option value="email_pdf">Email PDF</option>
          <option value="email_xlsx">Email XLSX</option>
          <option value="whatsapp_summary">WhatsApp summary</option>
          <option value="dashboard_embed">Dashboard embed</option>
        </select>
        <label className="block text-xs smallcaps">Cron</label>
        <input
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs tabular"
        />
        <div className="text-[var(--fg-muted)] text-xs">e.g. <span className="tabular">0 7 * * 1</span> for Mondays at 7am</div>
        {err ? <div className="text-xs text-[var(--danger)]">{err}</div> : null}
        <Button type="button" onClick={submit} disabled={busy || !recipient}>
          {busy ? 'Saving...' : 'Save schedule'}
        </Button>
      </CardContent>
    </Card>
  );
}
