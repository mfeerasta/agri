'use client';
import * as React from 'react';
import { updateNotificationPrefs, sendTestNotification } from '../actions';

const CHANNELS = ['in_app', 'whatsapp', 'email', 'push'] as const;
export type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  in_app: 'In-app',
  whatsapp: 'WhatsApp',
  email: 'Email',
  push: 'Push',
};

export const EVENT_KEYS = [
  'approvalSubmitted',
  'approvalDecided',
  'escalationReminder',
  'mention',
  'taskAssigned',
  'taskDueSoon',
  'taskOverdue',
  'anomalyDiesel',
  'anomalyWeather',
  'diagnosticFlagged',
  'digestDaily',
  'digestWeekly',
] as const;

export type EventKey = (typeof EVENT_KEYS)[number];

const EVENTS: Array<{ key: EventKey; label: string; hint: string }> = [
  { key: 'approvalSubmitted', label: 'Approval submitted to me', hint: 'A request needs my decision' },
  { key: 'approvalDecided', label: 'My approval decided', hint: 'Approved, rejected, or sent back' },
  { key: 'escalationReminder', label: 'Escalation reminder', hint: 'Pending approval is 24h+ old' },
  { key: 'mention', label: '@-mention in a comment', hint: 'Someone called me out' },
  { key: 'taskAssigned', label: 'Task assigned', hint: 'A task was assigned to me' },
  { key: 'taskDueSoon', label: 'Task due soon', hint: 'Due within 24h' },
  { key: 'taskOverdue', label: 'Task overdue', hint: 'Past its due date' },
  { key: 'anomalyDiesel', label: 'Diesel anomaly', hint: 'Variance, theft pattern, suspicious log' },
  { key: 'anomalyWeather', label: 'Weather alert', hint: 'Frost, heatwave, hail warning' },
  { key: 'diagnosticFlagged', label: 'Diagnostic flagged', hint: 'Crop diagnostic is high or critical' },
  { key: 'digestDaily', label: 'Daily ops digest', hint: 'Morning operational summary' },
  { key: 'digestWeekly', label: 'Weekly summary', hint: 'End-of-week recap' },
];

export interface QuietHours {
  enabled: boolean;
  startHhmm: string;
  endHhmm: string;
}

export type NotificationPrefsShape = Record<EventKey, Channel[]> & { quietHours: QuietHours };

interface Props {
  initial: NotificationPrefsShape;
}

export function NotificationsPrefsClient(props: Props): React.ReactElement {
  const [prefs, setPrefs] = React.useState<NotificationPrefsShape>(props.initial);
  const [status, setStatus] = React.useState<
    | { kind: 'idle' | 'saving' | 'saved' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const [testStatus, setTestStatus] = React.useState<string>('');

  function toggle(eventKey: EventKey, channel: Channel): void {
    setPrefs((p) => {
      const current = p[eventKey];
      const next = current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel];
      return { ...p, [eventKey]: next };
    });
  }

  function setQuietHours(patch: Partial<QuietHours>): void {
    setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, ...patch } }));
  }

  async function save(): Promise<void> {
    setStatus({ kind: 'saving' });
    const result = await updateNotificationPrefs(prefs);
    if (result.ok) setStatus({ kind: 'saved' });
    else setStatus({ kind: 'error', message: result.error });
  }

  async function fireTest(channel: Channel): Promise<void> {
    setTestStatus(`Sending ${CHANNEL_LABELS[channel]} test...`);
    const result = await sendTestNotification(channel);
    setTestStatus(result.ok ? `${CHANNEL_LABELS[channel]} test sent` : `Failed: ${result.error}`);
  }

  return (
    <div className="space-y-6">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--rule)]">
            <th className="py-2 text-left">Event</th>
            {CHANNELS.map((c) => (
              <th key={c} className="py-2 px-2 text-center">{CHANNEL_LABELS[c]}</th>
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
                    aria-label={`${ev.label} via ${CHANNEL_LABELS[c]}`}
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

      <div className="rounded-lg border border-[var(--rule)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Quiet hours</div>
            <div className="text-xs text-[var(--ink-muted)]">
              During this window, only in-app rows are created. No push, WhatsApp, or email.
              Times use your local time zone (Asia/Karachi by default).
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.quietHours.enabled}
              onChange={(e) => setQuietHours({ enabled: e.target.checked })}
              className="h-5 w-5"
            />
            Enabled
          </label>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            From
            <input
              type="time"
              value={prefs.quietHours.startHhmm}
              onChange={(e) => setQuietHours({ startHhmm: e.target.value })}
              className="rounded border border-[var(--rule)] bg-[var(--surface)] px-2 py-1"
              disabled={!prefs.quietHours.enabled}
            />
          </label>
          <label className="flex items-center gap-2">
            To
            <input
              type="time"
              value={prefs.quietHours.endHhmm}
              onChange={(e) => setQuietHours({ endHhmm: e.target.value })}
              className="rounded border border-[var(--rule)] bg-[var(--surface)] px-2 py-1"
              disabled={!prefs.quietHours.enabled}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
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

      <div className="rounded-lg border border-[var(--rule)] p-4 space-y-2">
        <div className="font-medium">Test a channel</div>
        <div className="text-xs text-[var(--ink-muted)]">
          Sends a sample notification to confirm delivery on each channel.
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => fireTest(c)}
              className="min-h-[40px] rounded-lg border border-[var(--rule)] px-3 py-1.5 text-sm hover:bg-[var(--surface)]"
            >
              Test {CHANNEL_LABELS[c]}
            </button>
          ))}
        </div>
        {testStatus ? <div className="text-sm text-[var(--ink-muted)]">{testStatus}</div> : null}
      </div>
    </div>
  );
}
