'use client';

import * as React from 'react';

export interface WelcomeModalProps {
  userName: string;
  onStartTour: () => void;
  onSkip: () => void;
  storageKey?: string;
}

/**
 * Full-screen first-run welcome. Persists dismissal in localStorage so
 * MF only sees it once. Skip-for-now also flips the flag so we don't
 * pester directors every login.
 */
export function WelcomeModal({ userName, onStartTour, onSkip, storageKey = 'zameen.welcome.seen' }: WelcomeModalProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(storageKey);
    if (!seen) setOpen(true);
  }, [storageKey]);

  if (!open) return null;

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, '1');
    }
    setOpen(false);
  }

  function handleStart() {
    dismiss();
    onStartTour();
  }

  function handleSkip() {
    dismiss();
    onSkip();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Zameen"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="max-w-lg w-full rounded-md bg-[var(--paper)] text-[var(--ink)] p-8 shadow-2xl border border-[var(--rule)]">
        <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60 mb-2">Welcome</div>
        <h2 className="text-2xl font-semibold mb-2">Welcome to Zameen, {userName}</h2>
        <p className="text-sm text-[var(--ink)]/80 mb-6">
          Let&apos;s walk you through your first 5 minutes. We&apos;ll show you the
          dashboard, where approvals live, and how to find per-field P&amp;L.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm px-4 py-2 rounded border border-[var(--rule)] hover:bg-[var(--paper-2)] min-h-[40px]"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="text-sm px-4 py-2 rounded bg-[var(--accent)] text-white min-h-[40px]"
          >
            Start tour
          </button>
        </div>
      </div>
    </div>
  );
}
