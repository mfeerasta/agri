'use client';
import { useMemo, useState, useTransition } from 'react';
import { createSchedule, skipSchedule } from './actions';

interface FieldLite { id: string; label: string; acres: number }
interface SourceLite { id: string; kind: string; identifier: string | null }
interface SlotLite {
  id: string;
  waterSourceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}
interface ScheduleLite {
  id: string;
  fieldId: string;
  scheduledFor: string;
  warabandiSlotId: string | null;
  status: string;
  expectedDurationMinutes: number | null;
}

interface Props {
  fields: FieldLite[];
  sources: SourceLite[];
  slots: SlotLite[];
  schedules: ScheduleLite[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Pick the upcoming date for a given dayOfWeek (next 7 days). Combined with startTime.
function nextDateForDay(dayOfWeek: number, startTime: string): Date {
  const now = new Date();
  const today = now.getDay();
  let diff = (dayOfWeek - today + 7) % 7;
  if (diff === 0) diff = 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  const [hh = '0', mm = '0'] = startTime.split(':');
  d.setHours(Number(hh), Number(mm), 0, 0);
  return d;
}

export function ScheduleBoardClient({ fields, sources, slots, schedules }: Props) {
  const [dragField, setDragField] = useState<FieldLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const schedulesBySlot = useMemo(() => {
    const m: Record<string, ScheduleLite[]> = {};
    for (const s of schedules) {
      const key = s.warabandiSlotId ?? 'none';
      (m[key] ??= []).push(s);
    }
    return m;
  }, [schedules]);

  const onDrop = (slot: SlotLite) => {
    if (!dragField) return;
    const scheduledFor = nextDateForDay(slot.dayOfWeek, slot.startTime).toISOString();
    start(async () => {
      const res = await createSchedule({
        fieldId: dragField.id,
        warabandiSlotId: slot.id,
        waterSourceId: slot.waterSourceId,
        scheduledFor,
        expectedDurationMinutes: slot.durationMinutes,
      });
      if (!res.ok) setError(res.error);
      else setError(null);
      setDragField(null);
    });
  };

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4 p-3">
      <aside className="space-y-2">
        <div className="smallcaps text-xs">Fields</div>
        {fields.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={() => setDragField(f)}
            className="cursor-move rounded border border-[var(--rule)] bg-white p-2 text-sm shadow-sm"
          >
            <div className="font-medium">{f.label}</div>
            <div className="tabular text-[0.7rem] text-[var(--ink)]/50">{f.acres.toFixed(2)} acres</div>
          </div>
        ))}
        {fields.length === 0 && <div className="text-sm text-[var(--ink)]/50">No fields.</div>}
      </aside>

      <section>
        {error && (
          <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">{error}</div>
        )}
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d, di) => (
            <div key={d} className="rounded border border-[var(--rule)] p-2">
              <div className="mb-2 text-xs font-semibold">{d}</div>
              <div className="space-y-2">
                {slots.filter((s) => s.dayOfWeek === di).map((slot) => {
                  const source = sources.find((x) => x.id === slot.waterSourceId);
                  const planned = schedulesBySlot[slot.id] ?? [];
                  return (
                    <div
                      key={slot.id}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={() => onDrop(slot)}
                      className="rounded border border-dashed border-[var(--rule)] bg-[var(--rule)]/10 p-1 text-[0.65rem]"
                    >
                      <div className="font-medium">{source?.identifier ?? source?.kind}</div>
                      <div className="tabular text-[var(--ink)]/50">{slot.startTime}-{slot.endTime}</div>
                      {planned.map((p) => {
                        const f = fields.find((x) => x.id === p.fieldId);
                        return (
                          <div key={p.id} className="mt-1 flex items-center justify-between rounded bg-emerald-100 px-1 py-0.5 text-emerald-900">
                            <span className="truncate">{f?.label ?? p.fieldId.slice(0, 6)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const reason = prompt('Reason for skipping?');
                                if (reason) start(async () => { await skipSchedule(p.id, reason); });
                              }}
                              disabled={pending}
                              title="Skip"
                              className="ml-1 text-emerald-700 hover:text-red-700"
                            >×</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {slots.filter((s) => s.dayOfWeek === di).length === 0 && (
                  <div className="text-[0.65rem] text-[var(--ink)]/40">No slots</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
