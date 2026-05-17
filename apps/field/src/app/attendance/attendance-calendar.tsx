import * as React from 'react';

interface Record {
  workDate: string;
  status: string;
  checkedIn: boolean;
  checkedOut: boolean;
}

function glyph(r: Record | undefined): { ch: string; cls: string } {
  if (!r) return { ch: '·', cls: 'text-[var(--ink)]/30' };
  if (r.status === 'leave') return { ch: 'L', cls: 'text-[var(--clay)]' };
  if (r.status === 'absent') return { ch: '✗', cls: 'text-[var(--rust)]' };
  if (r.checkedOut) return { ch: '✓', cls: 'text-[var(--zameen-700)]' };
  if (r.checkedIn) return { ch: '◐', cls: 'text-[var(--zameen-500)]' };
  return { ch: '·', cls: 'text-[var(--ink)]/30' };
}

export function AttendanceCalendar({ records }: { records: Record[] }) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const byDate = new Map(records.map((r) => [r.workDate, r] as const));
  const cells: { day: number; r: Record | undefined }[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = new Date(now.getFullYear(), now.getMonth(), d).toISOString().slice(0, 10);
    cells.push({ day: d, r: byDate.get(iso) });
  }
  return (
    <section className="border-t border-[var(--rule)] pt-3">
      <h2 className="smallcaps text-[0.72rem] text-[var(--ink)]/70 mb-2">This month</h2>
      <div className="grid grid-cols-7 gap-1 tabular text-sm" dir="ltr">
        {cells.map(({ day, r }) => {
          const g = glyph(r);
          return (
            <div key={day} className="aspect-square border border-[var(--rule)] flex flex-col items-center justify-center">
              <span className="text-[0.65rem] text-[var(--ink)]/50">{day}</span>
              <span className={g.cls}>{g.ch}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
