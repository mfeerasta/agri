'use client';
import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../lib/cn.js';

export interface ChartCardImplProps {
  title: string;
  data: Array<Record<string, number | string>>;
  xKey: string;
  yKey: string;
  unit?: string;
  height?: number;
  className?: string;
}

export default function ChartCardImpl({
  title,
  data,
  xKey,
  yKey,
  unit,
  height = 220,
  className,
}: ChartCardImplProps) {
  return (
    <div className={cn('rounded-[14px] bg-[var(--surface)] border border-[var(--border)] shadow-soft p-5', className)}>
      <div className="flex items-baseline justify-between pb-3">
        <div className="font-display text-[1rem] font-medium text-[var(--fg)]">{title}</div>
        {unit ? <div className="smallcaps">{unit}</div> : null}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'rgba(255,255,255,0.6)' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '2 2' }}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fg)',
              }}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--accent)', strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
