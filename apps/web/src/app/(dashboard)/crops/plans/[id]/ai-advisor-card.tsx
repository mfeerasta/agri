'use client';

/**
 * Client-side card that fetches /api/ai/crop-advisor/[id] and renders the
 * recommendation. Each nextAction has a "Create task" button that deep-links
 * to the task creation form with pre-filled title and rationale.
 */

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, AlertTriangle, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

interface AdvisorPayload {
  summary: string;
  nextActions: Array<{
    title: string;
    rationale: string;
    byDate: string | null;
    priority: 'low' | 'medium' | 'high';
  }>;
  risks: string[];
  confidence: number;
  cached?: boolean;
}

export function AiAdvisorCard({ cropPlanId }: { cropPlanId: string }) {
  const [data, setData] = React.useState<AdvisorPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/ai/crop-advisor/${cropPlanId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as AdvisorPayload;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cropPlanId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles size={16} /> AI advisor
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--fg-muted)]">Generating recommendations...</CardContent>
      </Card>
    );
  }
  if (error || !data || data.confidence === 0) {
    return null;
  }

  function priorityClass(p: 'low' | 'medium' | 'high'): string {
    if (p === 'high') return 'bg-[var(--danger)]/15 text-[var(--danger)]';
    if (p === 'medium') return 'bg-[var(--accent)]/15 text-[var(--accent)]';
    return 'bg-[var(--surface)] text-[var(--fg-muted)]';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles size={16} /> AI advisor
          {data.cached ? (
            <span className="ml-2 text-xs font-normal text-[var(--fg-muted)]">cached</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>{data.summary}</p>
        {data.nextActions.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)]">
              <ListChecks size={14} /> Next actions
            </div>
            <ul className="space-y-2">
              {data.nextActions.map((a, i) => {
                const params = new URLSearchParams({
                  title: a.title,
                  description: a.rationale,
                  cropPlanId,
                  ...(a.byDate ? { dueDate: a.byDate } : {}),
                });
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${priorityClass(a.priority)}`}
                        >
                          {a.priority}
                        </span>
                        {a.byDate ? (
                          <span className="text-xs text-[var(--fg-muted)]">by {a.byDate}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-[var(--fg-muted)]">{a.rationale}</div>
                    </div>
                    <Link
                      href={(`/crops/tasks/new?${params.toString()}`) as never}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface)]"
                    >
                      Create task
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {data.risks.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--fg-muted)]">
              <AlertTriangle size={14} /> Risks
            </div>
            <ul className="list-disc pl-5 text-xs">
              {data.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="text-[10px] text-[var(--fg-muted)]">
          Confidence {Math.round(data.confidence * 100)}%. Advisory only. Verify before acting.
        </div>
      </CardContent>
    </Card>
  );
}
