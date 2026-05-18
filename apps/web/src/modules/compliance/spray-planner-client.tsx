'use client';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, DeltaPill } from '@zameen/ui';
import { buildSprayPlan, scheduleSprayTask } from './spray-planner-actions';
import { searchPesticides, type PesticideEntry } from '@zameen/shared';

export interface CropPlanOption {
  id: string;
  fieldId: string;
  label: string;
}

interface SerializableWindow {
  dateIso: string;
  startLocalHour: number;
  endLocalHour: number;
  score: number;
  rationale: string;
  warnings: string[];
}

export function SprayPlannerClient({ cropPlanOptions }: { cropPlanOptions: CropPlanOption[] }) {
  const [cropPlanId, setCropPlanId] = React.useState<string>(cropPlanOptions[0]?.id ?? '');
  const [pesticide, setPesticide] = React.useState<PesticideEntry | null>(null);
  const [pesticideQuery, setPesticideQuery] = React.useState('');
  const [windows, setWindows] = React.useState<SerializableWindow[]>([]);
  const [fieldId, setFieldId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [scheduleMsg, setScheduleMsg] = React.useState<string>('');

  const suggestions = React.useMemo(
    () => (pesticide ? [] : searchPesticides(pesticideQuery, 8)),
    [pesticideQuery, pesticide],
  );

  function runPlan() {
    if (!cropPlanId || !pesticide) return;
    startTransition(async () => {
      const result = await buildSprayPlan({
        cropPlanId,
        pesticideName: pesticide.name,
        preHarvestIntervalDays: pesticide.phiDays,
      });
      if (result.ok) {
        setWindows(
          result.windows.map((w) => ({
            dateIso: w.date.toISOString(),
            startLocalHour: w.startLocalHour,
            endLocalHour: w.endLocalHour,
            score: w.score,
            rationale: w.rationale,
            warnings: w.warnings,
          })),
        );
        setFieldId(result.fieldId);
      } else {
        setScheduleMsg(result.error);
      }
    });
  }

  function schedule(window: SerializableWindow) {
    if (!fieldId || !pesticide) return;
    startTransition(async () => {
      const result = await scheduleSprayTask({
        cropPlanId,
        fieldId,
        pesticideName: pesticide.name,
        scheduledForIso: window.dateIso.slice(0, 10),
        startHour: window.startLocalHour,
        endHour: window.endLocalHour,
      });
      setScheduleMsg(result.ok ? 'Task created.' : `Failed: ${result.error}`);
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="smallcaps text-[0.7rem]">Crop plan</span>
            <select
              value={cropPlanId}
              onChange={(e) => setCropPlanId(e.currentTarget.value)}
              className="border-b border-[var(--rule)] bg-transparent py-2 font-mono text-sm"
            >
              {cropPlanOptions.length === 0 ? <option value="">No crop plans</option> : null}
              {cropPlanOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="relative grid gap-1 text-sm">
            <span className="smallcaps text-[0.7rem]">Pesticide</span>
            <input
              value={pesticide?.name ?? pesticideQuery}
              onChange={(e) => {
                setPesticide(null);
                setPesticideQuery(e.currentTarget.value);
              }}
              placeholder="Type to search (e.g. Imidacloprid)"
              className="border-b border-[var(--rule)] bg-transparent py-2 font-mono text-sm"
            />
            {!pesticide && pesticideQuery.length > 0 && suggestions.length > 0 ? (
              <ul className="absolute top-full z-10 mt-1 w-full border border-[var(--rule)] bg-[var(--paper)] shadow-ink">
                {suggestions.map((p) => (
                  <li key={p.name}>
                    <button
                      type="button"
                      onClick={() => {
                        setPesticide(p);
                        setPesticideQuery('');
                      }}
                      className="flex w-full items-baseline justify-between px-3 py-2 text-left hover:bg-[var(--paper-2)]"
                    >
                      <span>{p.name}</span>
                      <span className="smallcaps text-[0.65rem] text-[var(--ink)]/60">
                        {p.category} · PHI {p.phiDays}d
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {pesticide ? (
              <div className="text-xs text-[var(--ink)]/60">
                {pesticide.category} · PHI {pesticide.phiDays} days · {pesticide.commonOn.join(', ')}
              </div>
            ) : null}
          </label>
        </CardContent>
      </Card>

      <div>
        <button
          type="button"
          onClick={runPlan}
          disabled={pending || !cropPlanId || !pesticide}
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Computing windows...' : 'Find spray windows'}
        </button>
      </div>

      {scheduleMsg ? <div className="text-sm text-[var(--ink)]/70">{scheduleMsg}</div> : null}

      {windows.length > 0 ? (
        <div className="grid gap-3">
          {windows.map((w, i) => {
            const date = new Date(w.dateIso);
            const scorePct = Math.round(w.score * 100);
            const isViable = w.score > 0;
            return (
              <Card key={`${w.dateIso}-${w.startLocalHour}`}>
                <CardContent className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex items-baseline gap-3">
                      <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">#{i + 1}</span>
                      <span className="font-mono">
                        {date.toISOString().slice(0, 10)} · {String(w.startLocalHour).padStart(2, '0')}:00 to {String(w.endLocalHour).padStart(2, '0')}:00
                      </span>
                      <DeltaPill value={scorePct - 50} desirable="high" unit="" />
                      <span className="text-xs text-[var(--ink)]/60">score {scorePct}/100</span>
                    </div>
                    <div className="text-sm text-[var(--ink)]/80 mt-1">{w.rationale}</div>
                    {w.warnings.length > 0 ? (
                      <ul className="mt-1 text-xs text-[var(--danger)]">
                        {w.warnings.map((warn, j) => (
                          <li key={j}>! {warn}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => schedule(w)}
                    disabled={!isViable || pending}
                    className="px-3 py-2 rounded-md border border-[var(--rule)] text-sm disabled:opacity-40"
                  >
                    Schedule task
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
