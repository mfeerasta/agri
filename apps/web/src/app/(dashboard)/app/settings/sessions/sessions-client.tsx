'use client';

import { useState, useTransition } from 'react';
import {
  revokeOtherSessions,
  revokeSession,
  type SessionRow,
} from '../../../../../modules/settings/session-actions';

interface Props {
  initial: SessionRow[];
}

function shortBrowser(ua: string | null): string {
  if (!ua) return 'Unknown browser';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari';
  return 'Browser';
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SessionsClient({ initial }: Props): React.ReactElement {
  const [rows, setRows] = useState<SessionRow[]>(initial);
  const [status, setStatus] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  function onRevoke(id: string): void {
    setStatus('');
    startTransition(async () => {
      const res = await revokeSession(id);
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setStatus('Session signed out.');
      } else {
        setStatus(`Failed: ${res.error ?? 'unknown'}`);
      }
    });
  }

  function onRevokeOthers(): void {
    setStatus('');
    startTransition(async () => {
      const res = await revokeOtherSessions();
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.isCurrent));
        setStatus(`Signed out ${res.revoked} other session(s).`);
      } else {
        setStatus('Failed to sign out other sessions.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--ink-muted)]">{rows.length} active</span>
        <button
          type="button"
          onClick={onRevokeOthers}
          disabled={isPending || rows.length <= 1}
          className="rounded border border-[var(--line)] px-3 py-1 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          Sign out everywhere else
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded border border-[var(--line)] p-3 text-sm"
            data-current={r.isCurrent ? 'true' : 'false'}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">
                  {r.deviceLabel ?? shortBrowser(r.userAgent)}
                  {r.isPasskey && (
                    <span className="ml-2 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      Passkey{r.passkeyDeviceName ? `: ${r.passkeyDeviceName}` : ''}
                    </span>
                  )}
                  {r.isCurrent && (
                    <span className="ml-2 rounded bg-[var(--ink)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--surface)]">
                      This device
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--ink-muted)]">
                  {r.app} | {shortBrowser(r.userAgent)}
                  {r.ipAddressMasked ? ` | ${r.ipAddressMasked}` : ''}
                  {r.country ? ` | ${[r.city, r.country].filter(Boolean).join(', ')}` : ''}
                </div>
                <div className="text-xs text-[var(--ink-muted)]">
                  Signed in {formatWhen(r.signedInAt)} | last active {formatWhen(r.lastActiveAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(r.id)}
                disabled={isPending}
                className="rounded border border-[var(--line)] px-2 py-1 text-xs hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {r.isCurrent ? 'Sign out this device' : 'Sign out'}
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded border border-dashed border-[var(--line)] p-4 text-center text-xs text-[var(--ink-muted)]">
            No active sessions.
          </li>
        )}
      </ul>

      {status && <p className="text-xs text-[var(--ink-muted)]">{status}</p>}
    </div>
  );
}
