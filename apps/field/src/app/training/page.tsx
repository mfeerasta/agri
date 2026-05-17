'use client';

import * as React from 'react';
import Link from 'next/link';
import { Masthead } from '@zameen/ui';
import { useTrainingMode, markStep, TRAINING_STEPS, type TrainingStepId } from '../../lib/training-store';

interface StepCopy {
  id: TrainingStepId;
  ur: string;
  romanUr: string;
  href: string;
  en: string;
}

const STEPS: StepCopy[] = [
  { id: 'attendance-checkin', ur: 'حاضری لگائیں', romanUr: 'Haazri lagayein', href: '/attendance', en: 'Check in for attendance' },
  { id: 'tasks-open', ur: 'آج کے کام کھولیں', romanUr: 'Aaj ke kaam kholein', href: '/tasks', en: "Open today's tasks" },
  { id: 'task-complete-photo', ur: 'ایک کام تصویر کے ساتھ مکمل کریں', romanUr: 'Kaam tasveer ke saath mukammal karein', href: '/tasks', en: 'Mark one task complete with a photo' },
  { id: 'diesel-log', ur: 'ڈیزل کا اندراج', romanUr: 'Diesel ka indraj', href: '/diesel/log?demo=1', en: 'Log a diesel use (mock asset T-DEMO, field F-DEMO)' },
  { id: 'milk-record', ur: 'دودھ کا اندراج', romanUr: 'Doodh ka indraj', href: '/livestock', en: 'Log a milk record' },
  { id: 'inspection-photo', ur: 'فصل کی تصویر لیں', romanUr: 'Fasal ki tasveer lein', href: '/photos', en: 'Take a field inspection photo' },
  { id: 'repair-request', ur: 'مرمت کی درخواست', romanUr: 'Marammat ki darkhwast', href: '/repair/new', en: 'Submit a repair request' },
  { id: 'sync-check', ur: 'سنک قطار چیک کریں', romanUr: 'Sync qatar check karein', href: '/sync', en: 'Sync queue check' },
];

export default function TrainingPage() {
  const { on, toggle, steps } = useTrainingMode();
  const score = Math.round((steps.length / TRAINING_STEPS.length) * 100);

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Home</Link>
      <Masthead section="TRAINING · تربیت" />

      {!on && (
        <div className="rounded border border-[var(--rule)] bg-[var(--paper-2)] p-3 space-y-2">
          <p className="text-sm urdu">تربیتی موڈ آن کریں تاکہ اصل ڈیٹا متاثر نہ ہو۔</p>
          <p className="text-xs text-[var(--ink)]/70">Turn training mode ON to avoid affecting real data.</p>
          <button
            type="button"
            onClick={() => toggle(true)}
            className="min-h-[44px] px-3 py-2 rounded bg-yellow-400 text-black text-sm font-medium"
          >
            Turn ON · آن کریں
          </button>
        </div>
      )}

      <div className="rounded border border-[var(--rule)] p-3">
        <div className="flex items-baseline justify-between">
          <span className="smallcaps text-[0.72rem]">Score</span>
          <span className="tabular text-sm">{score}/100 · {steps.length}/{TRAINING_STEPS.length}</span>
        </div>
        <div className="mt-2 h-2 w-full rounded bg-[var(--paper-2)] overflow-hidden">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${score}%` }} />
        </div>
      </div>

      <ol className="space-y-2">
        {STEPS.map((s, idx) => {
          const done = steps.includes(s.id);
          return (
            <li
              key={s.id}
              className={`rounded border ${done ? 'border-green-600 bg-green-50' : 'border-[var(--rule)]'} p-3`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium ${
                    done ? 'bg-green-600 text-white' : 'bg-[var(--paper-2)]'
                  }`}
                  aria-label={done ? 'Completed' : `Step ${idx + 1}`}
                >
                  {done ? '✓' : idx + 1}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="urdu text-base">{s.ur}</div>
                  <div className="text-xs italic text-[var(--ink)]/70">{s.romanUr}</div>
                  <div className="text-xs text-[var(--ink)]/60">{s.en}</div>
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={s.href}
                      className="inline-flex items-center min-h-[36px] text-xs px-3 py-1.5 rounded bg-[var(--accent)] text-white"
                    >
                      Open · کھولیں
                    </Link>
                    {!done && (
                      <button
                        type="button"
                        onClick={() => markStep(s.id)}
                        className="inline-flex items-center min-h-[36px] text-xs px-3 py-1.5 rounded border border-[var(--rule)]"
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
