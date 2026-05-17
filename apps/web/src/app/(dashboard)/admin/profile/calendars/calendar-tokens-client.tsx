'use client';

import * as React from 'react';
import { createCalendarToken, revokeCalendarToken } from '@/modules/calendars/actions';

export interface TokenRow {
  id: string;
  scope: string;
  createdAt: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  subscribeUrl: string;
}

const SCOPES: { value: string; label: string }[] = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'crop_plans', label: 'Crop plans' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'feasibilities', label: 'Feasibility reviews' },
  { value: 'all', label: 'All scopes' },
];

export function CalendarTokensClient({ tokens }: { tokens: TokenRow[] }) {
  const [scope, setScope] = React.useState<string>('tasks');
  const [expiresInDays, setExpiresInDays] = React.useState<number | ''>('');
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState<string | null>(null);

  function copy(url: string, id: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  function onGenerate() {
    startTransition(async () => {
      await createCalendarToken({
        scope: scope as 'tasks' | 'crop_plans' | 'approvals' | 'feasibilities' | 'all',
        expiresInDays: typeof expiresInDays === 'number' ? expiresInDays : undefined,
      });
    });
  }

  function onRevoke(id: string) {
    if (!window.confirm('Revoke this calendar token?')) return;
    startTransition(async () => {
      await revokeCalendarToken(id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border border-[var(--rule)] p-3">
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">Scope</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="border border-[var(--ink)] px-2 py-1 text-sm"
          >
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block smallcaps text-[0.65rem] mb-1">Expires in (days)</label>
          <input
            type="number"
            min={1}
            placeholder="never"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
            className="border border-[var(--ink)] px-2 py-1 text-sm w-32"
          />
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending}
          className="border border-[var(--ink)] px-4 py-1.5 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
        >
          {pending ? 'Working' : 'Generate token'}
        </button>
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-[var(--ink)]/50">No tokens yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
            <tr>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Scope</th>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Subscribe URL</th>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Created</th>
              <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
              <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Action</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-b border-[var(--rule)]/50">
                <td className="px-3 py-2">{t.scope}</td>
                <td className="px-3 py-2 max-w-[400px] truncate">
                  <code className="text-xs">{t.subscribeUrl}</code>
                </td>
                <td className="px-3 py-2 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-xs">
                  {t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'never'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => copy(t.subscribeUrl, t.id)}
                    className="border border-[var(--ink)] px-2 py-1 smallcaps text-[0.65rem] hover:bg-[var(--ink)] hover:text-[var(--paper)] mr-2"
                  >
                    {copied === t.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRevoke(t.id)}
                    disabled={pending}
                    className="border border-[var(--ink)] px-2 py-1 smallcaps text-[0.65rem] hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
