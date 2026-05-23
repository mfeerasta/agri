'use client';

import { useState, useTransition } from 'react';
import {
  sendTestNotification,
  updateNotificationPreferences,
  type NotificationPrefsState,
  type TestChannel,
} from '../../../../../modules/settings/notification-actions';
import type { DigestMode } from '@zameen/db';

const CHANNELS: Array<{ key: TestChannel; label: string }> = [
  { key: 'in_app', label: 'In-app' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'push', label: 'Push' },
];

const KINDS: Array<{ key: string; label: string }> = [
  { key: 'approvalSubmitted', label: 'Approval submitted' },
  { key: 'approvalDecided', label: 'Approval decided' },
  { key: 'escalationReminder', label: 'Escalation reminder' },
  { key: 'mention', label: 'Mention' },
  { key: 'taskAssigned', label: 'Task assigned' },
  { key: 'taskDueSoon', label: 'Task due soon' },
  { key: 'taskOverdue', label: 'Task overdue' },
  { key: 'anomalyDiesel', label: 'Diesel anomaly' },
  { key: 'anomalyWeather', label: 'Weather anomaly' },
  { key: 'diagnosticFlagged', label: 'Diagnostic flagged' },
  { key: 'digestDaily', label: 'Daily digest' },
  { key: 'digestWeekly', label: 'Weekly digest' },
];

const DIGEST_MODES: Array<{ key: DigestMode; label: string }> = [
  { key: 'instant', label: 'Instant' },
  { key: 'hourly', label: 'Hourly batch' },
  { key: 'daily_morning', label: 'Daily, morning' },
  { key: 'daily_evening', label: 'Daily, evening' },
];

interface Props {
  initial: NotificationPrefsState;
}

export function NotificationSettingsClient({ initial }: Props): React.ReactElement {
  const [channels, setChannels] = useState(initial.channelsEnabled);
  const [kindsDisabled, setKindsDisabled] = useState<string[]>(initial.kindsDisabled);
  const [quietStart, setQuietStart] = useState<string>(initial.quietHoursStart ?? '');
  const [quietEnd, setQuietEnd] = useState<string>(initial.quietHoursEnd ?? '');
  const [digestMode, setDigestMode] = useState<DigestMode>(initial.digestMode);
  const [status, setStatus] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  function toggleKind(key: string): void {
    setKindsDisabled((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function save(): void {
    setStatus('');
    startTransition(async () => {
      const res = await updateNotificationPreferences({
        channelsEnabled: channels,
        kindsDisabled,
        quietHoursStart: quietStart ? quietStart : null,
        quietHoursEnd: quietEnd ? quietEnd : null,
        digestMode,
      });
      setStatus(res.ok ? 'Saved.' : `Failed: ${res.error ?? 'unknown'}`);
    });
  }

  function sendTest(channel: TestChannel): void {
    setStatus('');
    startTransition(async () => {
      const res = await sendTestNotification(channel);
      setStatus(res.ok ? `Test sent to ${channel}.` : `Test failed: ${res.error ?? 'unknown'}`);
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Channels</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          Turning a channel off suppresses all outbound delivery on that channel. In-app history is
          always recorded.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <div
              key={c.key}
              className="flex items-center justify-between rounded border border-[var(--line)] p-3"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channels[c.key]}
                  onChange={(e) => setChannels({ ...channels, [c.key]: e.target.checked })}
                />
                <span>{c.label}</span>
              </label>
              <button
                type="button"
                onClick={() => sendTest(c.key)}
                disabled={isPending}
                className="rounded border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--surface-2)]"
              >
                Send test
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Mute by kind</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <label
              key={k.key}
              className="flex items-center gap-2 rounded border border-[var(--line)] p-2 text-sm"
            >
              <input
                type="checkbox"
                checked={!kindsDisabled.includes(k.key)}
                onChange={() => toggleKind(k.key)}
              />
              <span>{k.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Quiet hours</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          During this window, push/WhatsApp/email are queued and released at the next digest mark.
          Leave blank to disable.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs">
            <span>Start</span>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="mt-1 rounded border border-[var(--line)] px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs">
            <span>End</span>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="mt-1 rounded border border-[var(--line)] px-2 py-1 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Digest mode</h2>
        <div className="flex flex-wrap gap-2">
          {DIGEST_MODES.map((m) => (
            <label
              key={m.key}
              className="flex items-center gap-2 rounded border border-[var(--line)] px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="digestMode"
                value={m.key}
                checked={digestMode === m.key}
                onChange={() => setDigestMode(m.key)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded bg-[var(--ink)] px-4 py-2 text-sm text-[var(--surface)] disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save preferences'}
        </button>
        {status && <span className="text-xs text-[var(--ink-muted)]">{status}</span>}
      </div>
    </div>
  );
}
