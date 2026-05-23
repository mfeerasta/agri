'use client';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, DashboardGrid } from '@zameen/ui';
import type { WidgetConfig } from '@zameen/ui';
import type { DashboardWidgetLayout } from '@zameen/db';

export function DashboardViewer({ layout }: { layout: DashboardWidgetLayout[] }) {
  const widgets: WidgetConfig[] = layout.map((w) => ({
    kind: 'stat',
    title: w.title,
    config: { reportId: w.reportId },
    gridPos: { x: w.x, y: w.y, w: w.w, h: w.h },
  }));
  return (
    <DashboardGrid
      widgets={widgets}
      renderWidget={(w) => {
        const cfg = w.config as { reportId?: string };
        return (
          <Card className="h-full">
            <CardHeader><CardTitle className="text-xs">{w.title}</CardTitle></CardHeader>
            <CardContent>
              <a
                href={cfg.reportId ? `/reports/${cfg.reportId}` : '#'}
                className="text-xs text-[var(--accent)] underline"
              >Open report</a>
            </CardContent>
          </Card>
        );
      }}
    />
  );
}
