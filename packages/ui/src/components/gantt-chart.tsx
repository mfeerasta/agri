'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface GanttItem {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  status?: string;
  critical?: boolean;
  assignees?: string[];
  dependencies?: string[];
}

export interface GanttChartProps {
  items: GanttItem[];
  startDate?: Date;
  endDate?: Date;
  onClick?: (id: string) => void;
  className?: string;
  rowHeight?: number;
  dayWidth?: number;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function statusBg(status?: string): string {
  switch (status) {
    case 'done':
    case 'completed':
    case 'executed':
    case 'harvested':
      return 'var(--success)';
    case 'in_progress':
    case 'in_review':
      return 'var(--accent)';
    case 'blocked':
    case 'sent_back':
    case 'on_hold':
      return 'var(--warning)';
    case 'cancelled':
    case 'rejected':
      return 'var(--danger)';
    default:
      return 'var(--fg-muted)';
  }
}

export function GanttChart({
  items,
  startDate,
  endDate,
  onClick,
  className,
  rowHeight = 32,
  dayWidth = 24,
}: GanttChartProps) {
  if (items.length === 0) {
    return (
      <div className={cn('rounded-[14px] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--fg-muted)]', className)}>
        Nothing scheduled.
      </div>
    );
  }

  const minStart = startDate
    ?? startOfDay(new Date(Math.min(...items.map((i) => i.startDate.getTime()))));
  const maxEnd = endDate
    ?? startOfDay(new Date(Math.max(...items.map((i) => i.endDate.getTime()))));
  const totalDays = Math.max(1, diffDays(minStart, maxEnd) + 1);
  const today = startOfDay(new Date());
  const todayOffset = diffDays(minStart, today);
  const showToday = todayOffset >= 0 && todayOffset <= totalDays;

  const positions = new Map<string, { y: number; x1: number; x2: number }>();
  items.forEach((it, idx) => {
    const x1 = diffDays(minStart, it.startDate) * dayWidth;
    const x2 = (diffDays(minStart, it.endDate) + 1) * dayWidth;
    const y = idx * rowHeight + rowHeight / 2;
    positions.set(it.id, { y, x1, x2 });
  });

  const labelWidth = 200;
  const gridWidth = totalDays * dayWidth;
  const svgHeight = items.length * rowHeight;

  return (
    <div className={cn('rounded-[14px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden', className)}>
      <div className="flex">
        <div className="shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)]/40" style={{ width: labelWidth }}>
          <div className="h-10 border-b border-[var(--border)] px-3 py-2 smallcaps text-xs">Task</div>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onClick?.(it.id)}
              className="flex w-full items-center gap-2 border-b border-[var(--border)] px-3 text-left text-xs hover:bg-[var(--surface)]"
              style={{ height: rowHeight }}
              title={it.title}
            >
              {it.critical ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden /> : null}
              <span className="truncate">{it.title}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div style={{ width: gridWidth }}>
            <div className="flex h-10 border-b border-[var(--border)]">
              {Array.from({ length: totalDays }).map((_, i) => {
                const d = new Date(minStart.getTime() + i * DAY_MS);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={cn(
                      'border-r border-[var(--border)] text-center text-[0.6rem] py-1',
                      weekend ? 'bg-[var(--surface-2)]/60 text-[var(--fg-subtle)]' : 'text-[var(--fg-muted)]',
                    )}
                    style={{ width: dayWidth }}
                  >
                    {fmtDay(d)}
                  </div>
                );
              })}
            </div>
            <svg width={gridWidth} height={svgHeight} className="block">
              {Array.from({ length: totalDays }).map((_, i) => {
                const d = new Date(minStart.getTime() + i * DAY_MS);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <rect
                    key={i}
                    x={i * dayWidth}
                    y={0}
                    width={dayWidth}
                    height={svgHeight}
                    fill={weekend ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  />
                );
              })}
              {items.map((_, idx) => (
                <line
                  key={idx}
                  x1={0}
                  x2={gridWidth}
                  y1={(idx + 1) * rowHeight}
                  y2={(idx + 1) * rowHeight}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              ))}
              {showToday ? (
                <line
                  x1={todayOffset * dayWidth + dayWidth / 2}
                  x2={todayOffset * dayWidth + dayWidth / 2}
                  y1={0}
                  y2={svgHeight}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              ) : null}
              {items.map((it) => {
                const pos = positions.get(it.id);
                if (!pos) return null;
                return (it.dependencies ?? []).map((depId) => {
                  const dep = positions.get(depId);
                  if (!dep) return null;
                  const x1 = dep.x2;
                  const y1 = dep.y;
                  const x2 = pos.x1;
                  const y2 = pos.y;
                  const midX = (x1 + x2) / 2;
                  return (
                    <path
                      key={`${depId}-${it.id}`}
                      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
                      stroke="var(--fg-subtle)"
                      strokeWidth={1}
                      fill="none"
                      markerEnd="url(#arrow)"
                      opacity={0.6}
                    />
                  );
                });
              })}
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--fg-subtle)" />
                </marker>
              </defs>
              {items.map((it) => {
                const pos = positions.get(it.id)!;
                const w = Math.max(dayWidth * 0.6, pos.x2 - pos.x1);
                const barH = rowHeight - 12;
                const y = pos.y - barH / 2;
                return (
                  <g key={it.id} className="cursor-pointer" onClick={() => onClick?.(it.id)}>
                    <rect
                      x={pos.x1}
                      y={y}
                      width={w}
                      height={barH}
                      rx={4}
                      fill={statusBg(it.status)}
                      opacity={0.7}
                      stroke={it.critical ? 'var(--danger)' : 'transparent'}
                      strokeWidth={1.5}
                    />
                    <text
                      x={pos.x1 + 6}
                      y={pos.y + 3}
                      fill="var(--bg)"
                      fontSize={10}
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      {it.title.length > 18 ? `${it.title.slice(0, 18)}…` : it.title}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
