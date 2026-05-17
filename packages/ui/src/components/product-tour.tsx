'use client';

import * as React from 'react';

export interface TourStep {
  selector: string;
  title: string;
  body: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

export interface ProductTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(selector: string): Rect | null {
  if (typeof window === 'undefined') return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

function placeTooltip(rect: Rect, placement: TourStep['placement']): React.CSSProperties {
  const gap = 12;
  switch (placement) {
    case 'top':
      return { top: rect.top - gap, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.left + rect.width + gap, transform: 'translateY(-50%)' };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - gap, transform: 'translate(-100%, -50%)' };
    case 'bottom':
    default:
      return { top: rect.top + rect.height + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
  }
}

const LS_KEY = (id: string) => `zameen.tour.${id}`;

export function ProductTour({ tourId, steps, onComplete, onSkip, autoStart = true }: ProductTourProps) {
  const [active, setActive] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);

  React.useEffect(() => {
    if (!autoStart) return;
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(LS_KEY(tourId));
    if (!seen) setActive(true);
  }, [tourId, autoStart]);

  React.useEffect(() => {
    if (!active) return;
    const step = steps[idx];
    if (!step) return;
    const update = () => setRect(getRect(step.selector));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const interval = window.setInterval(update, 250);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.clearInterval(interval);
    };
  }, [active, idx, steps]);

  if (!active) return null;
  const step = steps[idx];
  if (!step) return null;

  function next() {
    if (idx + 1 >= steps.length) {
      complete();
    } else {
      setIdx(idx + 1);
    }
  }

  function complete() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY(tourId), 'completed');
    }
    setActive(false);
    onComplete?.();
  }

  function skip() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY(tourId), 'skipped');
    }
    setActive(false);
    onSkip?.();
  }

  const tooltipStyle: React.CSSProperties = rect
    ? placeTooltip(rect, step.placement)
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 bg-black/55 pointer-events-auto" onClick={(e) => e.stopPropagation()} />

      {rect && (
        <div
          className="absolute rounded-md ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-black/40 pointer-events-none"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          }}
        />
      )}

      <div
        role="dialog"
        aria-label={step.title}
        className="absolute pointer-events-auto max-w-sm rounded-md bg-[var(--paper)] text-[var(--ink)] p-4 shadow-xl border border-[var(--rule)]"
        style={tooltipStyle}
      >
        <div className="smallcaps text-[0.7rem] text-[var(--ink)]/60 mb-1">
          Step {idx + 1} of {steps.length}
        </div>
        <div className="font-medium text-sm mb-1">{step.title}</div>
        <p className="text-sm text-[var(--ink)]/80 mb-3">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-[var(--ink)]/60 hover:text-[var(--ink)] min-h-[36px] px-2"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                type="button"
                onClick={() => setIdx(idx - 1)}
                className="text-xs px-3 py-1.5 rounded border border-[var(--rule)] hover:bg-[var(--paper-2)]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="text-xs px-3 py-1.5 rounded bg-[var(--accent)] text-white"
            >
              {idx + 1 >= steps.length ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function resetTour(tourId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LS_KEY(tourId));
}
