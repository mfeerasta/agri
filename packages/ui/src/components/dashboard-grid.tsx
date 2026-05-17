'use client';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export const WIDGET_KINDS = [
  'stat',
  'line_chart',
  'bar_chart',
  'pie_chart',
  'task_count',
  'recent_activity',
  'field_map_mini',
  'approval_queue_preview',
  'cash_position',
  'yoy_kpi',
  'field_trend_sparkline',
  'cost_pool_trend',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export interface WidgetGridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig {
  kind: WidgetKind;
  title: string;
  config: Record<string, unknown>;
  gridPos: WidgetGridPos;
}

export interface DashboardGridProps {
  widgets: WidgetConfig[];
  renderWidget: (w: WidgetConfig, idx: number) => React.ReactNode;
  className?: string;
}

export function DashboardGrid({ widgets, renderWidget, className }: DashboardGridProps) {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridAutoRows: '90px',
      }}
    >
      {widgets.map((w, idx) => (
        <div
          key={idx}
          style={{
            gridColumn: `${w.gridPos.x + 1} / span ${w.gridPos.w}`,
            gridRow: `${w.gridPos.y + 1} / span ${w.gridPos.h}`,
          }}
        >
          {renderWidget(w, idx)}
        </div>
      ))}
    </div>
  );
}
