'use client';

// ramadan-banner
// Mounts on Field PWA layout. Shows iftar countdown in Urdu when current
// day is in Ramadan. Receives server-resolved iftar timestamp + day index
// because we don't want to hit Aladhan from the browser.

import { useEffect, useState } from 'react';

export interface RamadanBannerProps {
  ramadanDay: number | null;
  iftarIso: string | null;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '۰';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} گھنٹے ${minutes} منٹ`;
  return `${minutes} منٹ`;
}

export function RamadanBanner({ ramadanDay, iftarIso }: RamadanBannerProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!iftarIso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [iftarIso]);

  if (ramadanDay === null || !iftarIso) return null;

  const iftarMs = new Date(iftarIso).getTime();
  const remaining = iftarMs - now;
  const passed = remaining <= 0;

  return (
    <div
      dir="rtl"
      role="status"
      className="border-y border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <strong>رمضان کا {ramadanDay}واں دن</strong>
      <span className="mx-2">|</span>
      {passed ? (
        <span>افطار ہو چکا ہے</span>
      ) : (
        <span>افطار میں {formatRemaining(remaining)} باقی</span>
      )}
    </div>
  );
}
