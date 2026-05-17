import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface Person {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface PersonPillProps {
  person: Person;
  size?: 'sm' | 'md';
  showName?: boolean;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const palette = ['#5BE3FF', '#F5B454', '#7FB069', '#E5B25D', '#74C69D', '#F4F1EA', '#52B788'];
  return palette[Math.abs(h) % palette.length]!;
}

export function PersonPill({ person, size = 'sm', showName = true, className }: PersonPillProps) {
  const sz = size === 'sm' ? 22 : 28;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-[var(--fg)]', className)}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full font-semibold text-[var(--bg)]"
        style={{ width: sz, height: sz, background: hashColor(person.id), fontSize: sz * 0.42 }}
        title={person.name}
      >
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          initials(person.name)
        )}
      </span>
      {showName ? <span className="truncate">{person.name}</span> : null}
    </span>
  );
}

export function PersonStack({ persons, max = 3, className }: { persons: Person[]; max?: number; className?: string }) {
  if (persons.length === 0) return <span className={cn('text-xs text-[var(--fg-subtle)]', className)}>Unassigned</span>;
  if (persons.length === 1) return <PersonPill person={persons[0]!} className={className} />;
  const visible = persons.slice(0, max);
  const overflow = persons.length - visible.length;
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span className="flex -space-x-1.5">
        {visible.map((p) => (
          <PersonPill key={p.id} person={p} showName={false} />
        ))}
      </span>
      {overflow > 0 ? <span className="ml-1.5 text-[0.7rem] text-[var(--fg-muted)]">+{overflow}</span> : null}
    </span>
  );
}
