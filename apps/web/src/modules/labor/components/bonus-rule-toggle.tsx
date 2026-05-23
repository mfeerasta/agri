'use client';
import * as React from 'react';
import { setBonusRuleSetActive } from '../bonus-actions';

export function BonusRuleToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [active, setActive] = React.useState(isActive);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await setBonusRuleSetActive({ id, isActive: !active });
        if (res.ok) setActive(!active);
        setBusy(false);
      }}
      className={
        active
          ? 'text-xs px-2 py-0.5 border border-green-500 text-green-700'
          : 'text-xs px-2 py-0.5 border border-[var(--border)] text-[var(--muted)]'
      }
    >
      {active ? 'فعال / Active' : 'غیر فعال / Inactive'}
    </button>
  );
}
