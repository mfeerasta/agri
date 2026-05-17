'use client';

import * as React from 'react';

const LS_KEY = 'zameen.field.training-mode';
const LS_STEPS = 'zameen.field.training-steps';

export const TRAINING_STEPS = [
  'attendance-checkin',
  'tasks-open',
  'task-complete-photo',
  'diesel-log',
  'milk-record',
  'inspection-photo',
  'repair-request',
  'sync-check',
] as const;

export type TrainingStepId = (typeof TRAINING_STEPS)[number];

export function isTrainingMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LS_KEY) === '1';
}

export function setTrainingMode(on: boolean): void {
  if (typeof window === 'undefined') return;
  if (on) {
    window.localStorage.setItem(LS_KEY, '1');
  } else {
    window.localStorage.removeItem(LS_KEY);
    window.localStorage.removeItem(LS_STEPS);
  }
  window.dispatchEvent(new CustomEvent('zameen-training-changed', { detail: { on } }));
}

export function getCompletedSteps(): TrainingStepId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_STEPS);
    if (!raw) return [];
    return JSON.parse(raw) as TrainingStepId[];
  } catch {
    return [];
  }
}

export function markStep(step: TrainingStepId): void {
  if (typeof window === 'undefined') return;
  const cur = getCompletedSteps();
  if (cur.includes(step)) return;
  const next = [...cur, step];
  window.localStorage.setItem(LS_STEPS, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('zameen-training-step', { detail: { step, steps: next } }));
}

export function useTrainingMode(): { on: boolean; toggle: (v: boolean) => void; steps: TrainingStepId[] } {
  const [on, setOn] = React.useState(false);
  const [steps, setSteps] = React.useState<TrainingStepId[]>([]);
  React.useEffect(() => {
    setOn(isTrainingMode());
    setSteps(getCompletedSteps());
    const onChange = () => {
      setOn(isTrainingMode());
      setSteps(getCompletedSteps());
    };
    window.addEventListener('zameen-training-changed', onChange);
    window.addEventListener('zameen-training-step', onChange);
    return () => {
      window.removeEventListener('zameen-training-changed', onChange);
      window.removeEventListener('zameen-training-step', onChange);
    };
  }, []);
  return { on, toggle: setTrainingMode, steps };
}
