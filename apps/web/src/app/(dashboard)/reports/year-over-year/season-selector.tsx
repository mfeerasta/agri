'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export interface SeasonSelectorProps {
  seasons: string[];
  currentSeason: string;
  previousSeason: string;
}

export function SeasonSelector({ seasons, currentSeason, previousSeason }: SeasonSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  function update(key: 'currentSeason' | 'previousSeason', val: string): void {
    const next = new URLSearchParams(params.toString());
    next.set(key, val);
    start(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">Current</label>
      <select
        value={currentSeason}
        onChange={(e) => update('currentSeason', e.target.value)}
        className="rounded-md border border-[var(--rule)] bg-[var(--surface)] px-2 py-1 text-sm"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <label className="smallcaps text-[0.65rem] text-[var(--fg-muted)]">vs</label>
      <select
        value={previousSeason}
        onChange={(e) => update('previousSeason', e.target.value)}
        className="rounded-md border border-[var(--rule)] bg-[var(--surface)] px-2 py-1 text-sm"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
