import type { JsonValue } from '@zameen/ui';
import { JsonDiff } from '@zameen/ui';
import { fmtDateTime } from '@/lib/format';

export interface TimelineRow {
  id: string;
  action: string;
  resource: string;
  occurredAt: Date | string;
  actorRole: string | null;
  actorName: string | null;
  actorId: string | null;
  before: JsonValue | null;
  after: JsonValue | null;
}

interface TimelineGroup {
  key: string;
  actorLabel: string;
  resource: string;
  startedAt: Date;
  endedAt: Date;
  rows: TimelineRow[];
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

// Color palette indexed by entity_kind. Keep these in sync with the
// approval banner and entity-label conventions so operators recognise
// at-a-glance which area an event belongs to.
const ENTITY_KIND_COLORS: Record<string, string> = {
  diesel_purchase: 'border-amber-500',
  diesel_daily_log: 'border-amber-400',
  repair_request: 'border-rose-500',
  repair_quote: 'border-rose-400',
  repair_work_order: 'border-rose-300',
  approval_request: 'border-violet-500',
  journal_entry: 'border-emerald-500',
  cost_allocation: 'border-emerald-400',
  crop_plan: 'border-lime-600',
  harvest_record: 'border-lime-500',
  field: 'border-green-600',
  user: 'border-sky-500',
  payroll_run: 'border-orange-500',
  mandi_dispatch: 'border-fuchsia-500',
};

function colorForResource(resource: string): string {
  return ENTITY_KIND_COLORS[resource] ?? 'border-[var(--rule)]';
}

function actorLabel(row: TimelineRow): string {
  return row.actorName ?? row.actorRole ?? 'unknown';
}

/**
 * Collapse runs of edits by the same actor on the same resource that occur
 * within `GROUP_WINDOW_MS` of each other into a single timeline group. Each
 * row in the group remains visible so the auditor can still inspect every
 * change, but the metadata (actor, span) is rendered once.
 */
export function groupTimelineRows(rows: TimelineRow[]): TimelineGroup[] {
  if (rows.length === 0) return [];
  // Rows come in DESC order; flip to ASC for grouping math, then flip back.
  const asc = [...rows].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  const groups: TimelineGroup[] = [];
  for (const r of asc) {
    const ts = new Date(r.occurredAt);
    const last = groups[groups.length - 1];
    const sameActor =
      last &&
      last.actorLabel === actorLabel(r) &&
      last.resource === r.resource &&
      ts.getTime() - last.endedAt.getTime() <= GROUP_WINDOW_MS;
    if (sameActor) {
      last.rows.push(r);
      last.endedAt = ts;
    } else {
      groups.push({
        key: r.id,
        actorLabel: actorLabel(r),
        resource: r.resource,
        startedAt: ts,
        endedAt: ts,
        rows: [r],
      });
    }
  }

  return groups.reverse();
}

interface TimelineProps {
  rows: TimelineRow[];
  csvHref?: string;
}

export function AuditTimeline({ rows, csvHref }: TimelineProps): JSX.Element {
  const groups = groupTimelineRows(rows);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">
          {rows.length} events · {groups.length} group{groups.length === 1 ? '' : 's'}
        </div>
        {csvHref ? (
          <a
            href={csvHref}
            className="smallcaps text-[0.7rem] text-[var(--ochre)] hover:underline"
          >
            export csv
          </a>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <div className="text-[var(--ink)]/60 text-sm">No audit_log rows for this resource id.</div>
      ) : null}

      {groups.map((g) => (
        <div
          key={g.key}
          className={`border-l-4 pl-3 ${colorForResource(g.resource)}`}
        >
          <div className="flex items-baseline justify-between">
            <div className="text-xs">
              <span className="font-medium">{g.actorLabel}</span>
              <span className="text-[var(--ink)]/60"> · {g.rows.length} edit{g.rows.length === 1 ? '' : 's'}</span>
            </div>
            <div className="tabular text-xs text-[var(--ink)]/60">
              {fmtDateTime(g.startedAt)}
              {g.startedAt.getTime() !== g.endedAt.getTime()
                ? ` → ${fmtDateTime(g.endedAt)}`
                : ''}
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {g.rows.map((row) => (
              <div key={row.id} className="rounded border border-[var(--rule)]/60 p-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="smallcaps text-[0.7rem] text-[var(--ochre)]">{row.action}</span>
                  <span className="tabular text-[0.7rem] text-[var(--ink)]/60">
                    {fmtDateTime(row.occurredAt)}
                  </span>
                </div>
                <JsonDiff before={row.before} after={row.after} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
