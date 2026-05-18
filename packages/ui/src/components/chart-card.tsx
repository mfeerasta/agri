'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';

export interface ChartCardProps {
  title: string;
  data: Array<Record<string, number | string>>;
  xKey: string;
  yKey: string;
  unit?: string;
  height?: number;
  className?: string;
}

// Lazy load the recharts-heavy implementation. Saves ~90KB gzipped from
// initial page bundles where the chart is below the fold.
const ChartCardImpl = dynamic(() => import('./chart-card-impl.js'), {
  ssr: false,
  loading: () => (
    <div className="h-[220px] bg-[var(--surface)] animate-pulse rounded-[14px]" />
  ),
});

export function ChartCard(props: ChartCardProps) {
  return <ChartCardImpl {...props} />;
}
