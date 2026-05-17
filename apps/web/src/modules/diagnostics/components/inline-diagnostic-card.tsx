'use client';
import * as React from 'react';
import { Card, CardContent } from '@zameen/ui';

export interface InlineDiagnosis {
  id?: string;
  photoUrl: string;
  diagnosisLabel: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe' | 'unknown';
  treatmentSuggestion: string;
  treatmentSuggestionUr: string;
  status?: 'pending_review' | 'confirmed' | 'dismissed' | 'treated' | 'resolved';
  loading?: boolean;
  error?: string | null;
}

function severityClass(sev: InlineDiagnosis['severity']): string {
  if (sev === 'severe') return 'bg-red-100 text-red-800 border-red-300';
  if (sev === 'moderate') return 'bg-amber-100 text-amber-800 border-amber-300';
  if (sev === 'mild') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  return 'bg-slate-100 text-slate-700 border-slate-300';
}

export function InlineDiagnosticCard({
  diag,
  onUpdateStatus,
}: {
  diag: InlineDiagnosis;
  onUpdateStatus?: (status: 'confirmed' | 'dismissed') => void | Promise<void>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={diag.photoUrl} alt="" className="h-16 w-16 rounded object-cover" />
          <div className="min-w-0 flex-1">
            {diag.loading ? (
              <p className="text-sm text-slate-500">Diagnosing...</p>
            ) : diag.error ? (
              <p className="text-sm text-red-600">{diag.error}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{diag.diagnosisLabel}</span>
                  <span className="tabular text-xs text-slate-500">
                    {(diag.confidence * 100).toFixed(0)}% conf.
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-xs ${severityClass(diag.severity)}`}>
                    {diag.severity}
                  </span>
                  {diag.status ? (
                    <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
                      {diag.status}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="mt-1 text-xs text-emerald-700 underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Hide treatment' : 'Show treatment'}
                </button>
              </>
            )}
          </div>
        </div>
        {expanded && !diag.loading && !diag.error ? (
          <div className="space-y-2 rounded bg-slate-50 p-3 text-sm">
            <p>{diag.treatmentSuggestion}</p>
            <p dir="rtl" className="urdu text-right">
              {diag.treatmentSuggestionUr}
            </p>
            {onUpdateStatus ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-md bg-emerald-700 px-3 py-1 text-xs text-white"
                  onClick={() => onUpdateStatus('confirmed')}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs"
                  onClick={() => onUpdateStatus('dismissed')}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
