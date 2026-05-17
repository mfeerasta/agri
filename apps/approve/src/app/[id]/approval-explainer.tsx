'use client';

/**
 * "Why this matters" panel. Fetches /api/ai/approval-explainer/[id] and
 * renders the 2-sentence summary, optional red flags, and comparable
 * context. Sits above the DecisionPanel.
 */

import * as React from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';

interface ExplainerPayload {
  summary: string;
  redFlags: string[] | null;
  comparableContext: string | null;
  cached?: boolean;
}

export function ApprovalExplainer({ approvalRequestId }: { approvalRequestId: string }) {
  const [data, setData] = React.useState<ExplainerPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai/approval-explainer/${approvalRequestId}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as ExplainerPayload;
      })
      .then((j) => {
        if (!cancelled && j && j.summary) setData(j);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [approvalRequestId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles size={16} /> Why this matters
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--fg-muted)]">Analysing...</CardContent>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles size={16} /> Why this matters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{data.summary}</p>
        {data.comparableContext ? (
          <p className="text-xs text-[var(--fg-muted)]">{data.comparableContext}</p>
        ) : null}
        {data.redFlags && data.redFlags.length > 0 ? (
          <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-2">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--danger)]">
              <AlertTriangle size={12} /> Red flags
            </div>
            <ul className="list-disc pl-4 text-xs">
              {data.redFlags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
