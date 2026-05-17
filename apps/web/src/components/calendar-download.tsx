'use client';

import * as React from 'react';
import Link from 'next/link';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function CalendarDownload({ scope = 'tasks' }: { scope?: 'tasks' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const now = new Date();
  const today = isoDate(now);
  const weekStart = isoDate(startOfWeek(now));
  const weekEnd = isoDate(new Date(startOfWeek(now).getTime() + 6 * 24 * 60 * 60 * 1000));
  const monthStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const base = `/api/exports/calendar/${scope === 'tasks' ? 'tasks' : 'tasks'}`;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
      >
        Download calendar
      </button>
      {open ? (
        <ul className="absolute right-0 z-30 mt-1 min-w-[200px] border border-[var(--ink)] bg-[var(--paper)] text-sm">
          <li>
            <a
              href={`${base}?from=${today}&to=${today}`}
              className="block px-3 py-2 hover:bg-[var(--paper-2)]"
              download="zameen-tasks-today.ics"
            >
              Today
            </a>
          </li>
          <li>
            <a
              href={`${base}?from=${weekStart}&to=${weekEnd}`}
              className="block px-3 py-2 hover:bg-[var(--paper-2)]"
              download="zameen-tasks-week.ics"
            >
              This week
            </a>
          </li>
          <li>
            <a
              href={`${base}?from=${monthStart}&to=${monthEnd}`}
              className="block px-3 py-2 hover:bg-[var(--paper-2)]"
              download="zameen-tasks-month.ics"
            >
              This month
            </a>
          </li>
          <li className="border-t border-[var(--rule)]">
            <Link href={'/admin/profile/calendars' as never} className="block px-3 py-2 hover:bg-[var(--paper-2)]">
              Subscribe (live)
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
