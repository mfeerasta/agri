'use client';
import * as React from 'react';
import { updateNotificationPrefs } from '../actions';

const CHANNELS = ['in_app', 'whatsapp', 'push', 'email'] as const;
type Channel = (typeof CHANNELS)[number];

const EVENTS: Array<{ key: keyof NotificationPrefsShape; label: string; hint: string }> = [
  { key: 'approvalSubmitted', label: 'Approval submitted', hint: 'A request needs my decision' },
  { key: 'approvalDecided', label: 'Approval decided', hint: 'My request was approved, rejected, or sent back' },
  { key: 'mention', label: 'Mentions', hint: 'Someone @-mentioned me' },
  { key: 'anomalyDetected', label: 'Anomalies', hint: 'Diesel, repair, or finance variance flagged' },
  { key: 'escalationReminder', label: 'Escalation reminders', hint: 'Approval pending past SLA' },
];

export interface NotificationPrefsShape {
  approvalSubmitted: Channel[];
  approvalDecided: Channel[];
  mention: Channel[];
  anomalyDetected: Channel[];
  escalationReminder: Channel[];
}

export function NotificationsPrefsClient(props: { initial: NotificationPrefsShape }): React.ReactElement {
  const [prefs, setPrefs] = React.useState<NotificationPrefsShape>(props.initial);
  const [status, setStatus] = React.useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>(
    { kind: 'idle' },
  );

  function toggle(eventKey: keyof NotificationPrefsShape, channel: Channel): void {
    setPrefs((p) => {
      const current = p[eventKey];
      const next = current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel];
      return { ...p, [eventKey]: next };
    });
  }

  async function save(): Promise<void> {
    setStatus({ kind: 'saving' });
    const result = await updateNotificationPrefs(prefs);
    if (result.ok) setStatus({ kind: 'saved' });
    else setStatus({ kind: 'error', message: result.error });
  }

  return (
    <div className="space-y-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--rule)]">
            <th className="py-2 text-left">Event</th>
            {CHANNELS.map((c) => (
              <th key={c} className="py-2 px-2 text-center capitalize">{c.replace('_', '-')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EVENTS.map((ev) => (
            <tr key={ev.key} className="border-b border-[var(--rule)]">
              <td className="py-2 align-top">
                <div className="font-medium">{ev.label}</div>
                <div className="text-xs text-[var(--ink-muted)]">{ev.hint}</div>
              </td>
              {CHANNELS.map((c) => (
                <td key={c} className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${ev.label} via ${c}`}
                    checked={prefs[ev.key].includes(c)}
                    onChange={() => toggle(ev.key, c)}
                    className="h-5 w-5"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status.kind === 'saving'}
          className="min-h-[44px] rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--paper)] hover:opacity-90 disabled:opacity-60"
        >
          {status.kind === 'saving' ? 'Saving...' : 'Save preferences'}
        </button>
        {status.kind === 'saved' ? <span className="text-sm text-[var(--moss)]">Saved.</span> : null}
        {status.kind === 'error' ? <span className="text-sm text-[var(--rust)]">{status.message}</span> : null}
      </div>
    </div>
  );
}
