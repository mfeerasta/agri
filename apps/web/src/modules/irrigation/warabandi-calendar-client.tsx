'use client';
import { useState, useTransition } from 'react';
import { upsertWarabandiSlot, deleteWarabandiSlot } from './actions';

interface SourceLite {
  id: string;
  kind: string;
  identifier: string | null;
  color: string;
  farmName: string;
}

interface SlotLite {
  id: string;
  waterSourceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  rotationWeeks: number;
  isActive: boolean;
  notes: string | null;
}

interface Props {
  days: string[];
  sources: SourceLite[];
  slots: SlotLite[];
}

// Hour columns 0..23
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function parseHm(t: string): number {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) + Number(m) / 60;
}

export function WarabandiCalendarClient({ days, sources, slots }: Props) {
  const [editing, setEditing] = useState<SlotLite | null>(null);
  const [creating, setCreating] = useState<{ dayOfWeek: number } | null>(null);
  const [pending, start] = useTransition();

  const slotsByDay = (d: number) => slots.filter((s) => s.dayOfWeek === d && s.isActive);

  return (
    <div className="overflow-x-auto p-3">
      <div className="min-w-[900px]">
        <div className="grid" style={{ gridTemplateColumns: '80px repeat(24, 1fr)' }}>
          <div />
          {HOURS.map((h) => (
            <div key={h} className="border-l border-[var(--rule)] text-center text-[0.6rem] text-[var(--ink)]/40">
              {h}
            </div>
          ))}
        </div>

        {days.map((dayLabel, dayIdx) => (
          <div key={dayIdx} className="relative grid border-t border-[var(--rule)]" style={{ gridTemplateColumns: '80px repeat(24, 1fr)', height: '48px' }}>
            <button
              type="button"
              onClick={() => setCreating({ dayOfWeek: dayIdx })}
              className="flex items-center justify-between px-2 text-left text-xs font-medium hover:bg-[var(--rule)]/30"
            >
              <span>{dayLabel}</span>
              <span className="text-[var(--ink)]/40">+</span>
            </button>
            {HOURS.map((h) => (
              <div key={h} className="border-l border-[var(--rule)]/40" />
            ))}
            {slotsByDay(dayIdx).map((s) => {
              const sh = parseHm(s.startTime);
              const eh = parseHm(s.endTime);
              const left = 80 + ((sh / 24) * (100 * 24 / 24)) * (((100 - 0) / 100));
              const source = sources.find((x) => x.id === s.waterSourceId);
              const leftPct = `calc(80px + ${(sh / 24) * 100}% - 80px * ${sh / 24})`;
              const widthPct = `calc(${((eh - sh) / 24) * 100}% - 80px * ${(eh - sh) / 24})`;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEditing(s)}
                  className="absolute top-1 bottom-1 overflow-hidden rounded text-[0.65rem] text-white shadow-sm"
                  style={{
                    background: source?.color ?? '#666',
                    left: leftPct,
                    width: widthPct,
                  }}
                  title={`${source?.identifier ?? source?.kind ?? ''} ${s.startTime}-${s.endTime}`}
                >
                  <span className="block truncate px-1">{source?.identifier ?? source?.kind} {s.startTime.slice(0, 5)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <SlotDialog
          mode={editing ? 'edit' : 'create'}
          sources={sources}
          slot={editing ?? undefined}
          dayOfWeek={creating?.dayOfWeek}
          onClose={() => { setEditing(null); setCreating(null); }}
          onSave={(input, id) => {
            start(async () => {
              await upsertWarabandiSlot(input, id);
              setEditing(null); setCreating(null);
            });
          }}
          onDelete={(id) => {
            start(async () => {
              await deleteWarabandiSlot(id);
              setEditing(null);
            });
          }}
          pending={pending}
        />
      )}
    </div>
  );
}

function SlotDialog(props: {
  mode: 'create' | 'edit';
  sources: SourceLite[];
  slot?: SlotLite;
  dayOfWeek?: number;
  pending: boolean;
  onClose: () => void;
  onSave: (input: Parameters<typeof upsertWarabandiSlot>[0], id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [waterSourceId, setWaterSourceId] = useState(props.slot?.waterSourceId ?? props.sources[0]?.id ?? '');
  const [dayOfWeek, setDayOfWeek] = useState<number>(props.slot?.dayOfWeek ?? props.dayOfWeek ?? 0);
  const [startTime, setStartTime] = useState(props.slot?.startTime?.slice(0, 5) ?? '06:00');
  const [endTime, setEndTime] = useState(props.slot?.endTime?.slice(0, 5) ?? '08:00');
  const [rotationWeeks, setRotationWeeks] = useState(props.slot?.rotationWeeks ?? 1);
  const [notes, setNotes] = useState(props.slot?.notes ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded bg-white p-4 shadow-lg">
        <h3 className="mb-3 text-lg font-semibold">{props.mode === 'edit' ? 'Edit slot' : 'New Warabandi slot'}</h3>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="smallcaps text-xs">Source</span>
            <select value={waterSourceId} onChange={(e) => setWaterSourceId(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1">
              {props.sources.map((s) => (
                <option key={s.id} value={s.id}>{s.identifier ?? s.kind} - {s.farmName}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="smallcaps text-xs">Day</span>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="block w-full rounded border border-[var(--rule)] p-1">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="smallcaps text-xs">Start</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
            </label>
            <label className="block">
              <span className="smallcaps text-xs">End</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" />
            </label>
          </div>
          <label className="block">
            <span className="smallcaps text-xs">Rotation weeks</span>
            <input type="number" min={1} value={rotationWeeks} onChange={(e) => setRotationWeeks(Number(e.target.value))} className="block w-full rounded border border-[var(--rule)] p-1" />
          </label>
          <label className="block">
            <span className="smallcaps text-xs">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="block w-full rounded border border-[var(--rule)] p-1" rows={2} />
          </label>
        </div>
        <div className="mt-4 flex justify-between">
          <div>
            {props.mode === 'edit' && props.slot && (
              <button
                type="button"
                onClick={() => props.onDelete(props.slot!.id)}
                disabled={props.pending}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={props.onClose} className="rounded border border-[var(--rule)] px-3 py-1 text-sm">Cancel</button>
            <button
              type="button"
              disabled={props.pending}
              onClick={() => props.onSave({
                waterSourceId,
                dayOfWeek,
                startTime,
                endTime,
                rotationWeeks,
                notes: notes || undefined,
              }, props.slot?.id)}
              className="rounded bg-black px-3 py-1 text-sm text-white"
            >
              {props.pending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
