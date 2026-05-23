'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Severity = 'info' | 'warn' | 'alert' | 'critical';

export interface LiveActivityItem {
  id: string;
  entityId: string;
  occurredAt: string;
  activityKind: string;
  resourceKind?: string | null;
  resourceId?: string | null;
  fieldId?: string | null;
  summary: string;
  summaryUr?: string | null;
  severity: Severity;
  actorName?: string | null;
}

interface LiveActivityFeedProps {
  entityId: string;
  fieldId?: string;
  initial?: LiveActivityItem[];
  max?: number;
  compact?: boolean;
  showLanguageToggle?: boolean;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  info: 'border-l-2 border-l-sky-400 bg-sky-50/40',
  warn: 'border-l-2 border-l-amber-400 bg-amber-50/60',
  alert: 'border-l-2 border-l-orange-500 bg-orange-50/70',
  critical: 'border-l-2 border-l-red-600 bg-red-50/80',
};

const SEVERITY_DOT: Record<Severity, string> = {
  info: 'bg-sky-500',
  warn: 'bg-amber-500',
  alert: 'bg-orange-600',
  critical: 'bg-red-600',
};

function drillDownHref(item: LiveActivityItem): string | null {
  if (!item.resourceKind || !item.resourceId) return null;
  switch (item.resourceKind) {
    case 'diesel_daily_logs':
      return `/app/diesel/logs/${item.resourceId}`;
    case 'harvest_records':
      return `/app/crops/harvests/${item.resourceId}`;
    case 'input_issuances':
      return `/app/inventory/issuances/${item.resourceId}`;
    case 'approval_requests':
      return `/app/approvals/${item.resourceId}`;
    case 'safety_incidents':
      return `/app/compliance/safety/${item.resourceId}`;
    default:
      return null;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return d.toLocaleDateString();
}

export function LiveActivityFeed({
  entityId,
  fieldId,
  initial = [],
  max = 50,
  compact = false,
  showLanguageToggle = true,
}: LiveActivityFeedProps) {
  const [items, setItems] = useState<LiveActivityItem[]>(initial);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showUrdu, setShowUrdu] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!entityId) return;
    const channel = supabase
      .channel(`live-activity:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'zameen',
          table: 'live_activity',
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (fieldId && row.field_id !== fieldId) return;
          const item: LiveActivityItem = {
            id: row.id as string,
            entityId: row.entity_id as string,
            occurredAt: row.occurred_at as string,
            activityKind: row.activity_kind as string,
            resourceKind: (row.resource_kind as string) ?? null,
            resourceId: (row.resource_id as string) ?? null,
            fieldId: (row.field_id as string) ?? null,
            summary: row.summary as string,
            summaryUr: (row.summary_ur as string) ?? null,
            severity: (row.severity as Severity) ?? 'info',
            actorName: (row.actor_name as string) ?? null,
          };
          setItems((prev) => [item, ...prev].slice(0, max));
        },
      )
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        if (!payload || typeof payload !== 'object') return;
        const p = payload as Record<string, unknown>;
        if (fieldId && p.fieldId !== fieldId) return;
        const item: LiveActivityItem = {
          id: (p.id as string) ?? crypto.randomUUID(),
          entityId: (p.entityId as string) ?? entityId,
          occurredAt: (p.occurredAt as string) ?? new Date().toISOString(),
          activityKind: (p.kind as string) ?? event,
          resourceKind: null,
          resourceId: null,
          fieldId: (p.fieldId as string) ?? null,
          summary: (p.summary as string) ?? event,
          summaryUr: (p.summaryUr as string) ?? null,
          severity: (p.severity as Severity) ?? 'info',
          actorName: null,
        };
        setItems((prev) => [item, ...prev].slice(0, max));
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [entityId, fieldId, max, supabase]);

  useEffect(() => {
    if (paused || !listRef.current) return;
    listRef.current.scrollTop = 0;
  }, [items, paused]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-400'}`}
            aria-label={connected ? 'connected' : 'disconnected'}
          />
          <span className="text-zinc-600">{connected ? 'Live' : 'Connecting...'}</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          {showLanguageToggle ? (
            <button
              type="button"
              onClick={() => setShowUrdu((s) => !s)}
              className="underline decoration-dotted"
            >
              {showUrdu ? 'EN' : 'UR'}
            </button>
          ) : null}
          {paused ? <span className="text-amber-600">Paused</span> : null}
        </div>
      </div>

      <ol
        ref={listRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className={`overflow-y-auto divide-y divide-zinc-100 ${compact ? 'max-h-64' : 'max-h-[70vh]'}`}
      >
        {items.length === 0 ? (
          <li className="text-sm text-zinc-500 py-6 text-center">No activity yet.</li>
        ) : (
          items.map((it) => {
            const href = drillDownHref(it);
            const text = showUrdu && it.summaryUr ? it.summaryUr : it.summary;
            const body = (
              <div className={`py-2 px-3 ${SEVERITY_STYLES[it.severity]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[it.severity]}`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm leading-snug truncate ${showUrdu && it.summaryUr ? 'text-right' : ''}`}
                        dir={showUrdu && it.summaryUr ? 'rtl' : 'ltr'}
                      >
                        {text}
                      </p>
                      {it.actorName ? (
                        <p className="text-xs text-zinc-500">{it.actorName}</p>
                      ) : null}
                    </div>
                  </div>
                  <time
                    className="text-xs text-zinc-500 flex-shrink-0"
                    dateTime={it.occurredAt}
                    title={new Date(it.occurredAt).toLocaleString()}
                  >
                    {formatTime(it.occurredAt)}
                  </time>
                </div>
              </div>
            );
            return (
              <li key={it.id}>
                {href ? (
                  <Link href={href} className="block hover:bg-zinc-50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}
