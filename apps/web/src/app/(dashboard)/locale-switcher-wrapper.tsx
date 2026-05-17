'use client';

import * as React from 'react';
import { LocaleSwitcher, type SwitcherLocale } from '@zameen/ui';
import { updateMyLocale } from '@/modules/profile/actions';

export function LocaleSwitcherWrapper({ current }: { current: SwitcherLocale }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <LocaleSwitcher
      current={current}
      onChange={(l) => {
        try {
          window.localStorage.setItem('zameenLocale', l);
        } catch {
          // ignore
        }
        startTransition(async () => {
          await updateMyLocale(l);
        });
      }}
      className={pending ? 'opacity-60' : ''}
    />
  );
}
