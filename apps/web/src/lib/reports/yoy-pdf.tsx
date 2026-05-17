import * as React from 'react';
import { View, Text } from '@react-pdf/renderer';
import {
  ReportShell,
  SimpleTable,
  SectionTitlePdf,
  fmtPdfMoney,
  fmtPdfQty,
  styles,
  BRAND,
  type ColumnSpec,
} from './report-template';
import type { YoYReportData } from './yoy-report';

export interface YoYPdfProps {
  data: YoYReportData;
  entityName: string;
  generatedBy: string;
  generatedAt?: Date;
}

function fmtPct(n: number | null): string {
  if (n === null) return 'n.a.';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)} %`;
}

export function YoYReportPdf({ data, entityName, generatedBy, generatedAt }: YoYPdfProps): React.ReactElement {
  const cols: ColumnSpec[] = [
    { key: 'crop', label: 'Crop', width: 18 },
    { key: 'yieldCurr', label: `${data.currentSeason} kg/ac`, width: 12, align: 'right' },
    { key: 'yieldPrev', label: `${data.previousSeason} kg/ac`, width: 12, align: 'right' },
    { key: 'yieldDelta', label: 'Yield Δ', width: 9, align: 'right' },
    { key: 'mpaCurr', label: 'Margin/ac', width: 14, align: 'right' },
    { key: 'mpaPrev', label: 'Prev margin/ac', width: 14, align: 'right' },
    { key: 'marginDelta', label: 'Margin Δ', width: 10, align: 'right' },
    { key: 'costDelta', label: 'Cost Δ', width: 11, align: 'right' },
  ];

  const rows = data.rows.map((r) => ({
    crop: r.cropName,
    yieldCurr: fmtPdfQty(r.current.yieldPerAcreKg, 0),
    yieldPrev: r.previous ? fmtPdfQty(r.previous.yieldPerAcreKg, 0) : 'n.a.',
    yieldDelta: fmtPct(r.yieldDeltaPct),
    mpaCurr: fmtPdfMoney(r.current.marginPerAcrePkr),
    mpaPrev: r.previous ? fmtPdfMoney(r.previous.marginPerAcrePkr) : 'n.a.',
    marginDelta: fmtPct(r.marginDeltaPct),
    costDelta: fmtPct(r.costDeltaPct),
  }));

  const poolCols: ColumnSpec[] = [
    { key: 'pool', label: 'Pool', width: 24 },
    { key: 'prev', label: `${data.previousSeason} total`, width: 18, align: 'right' },
    { key: 'curr', label: `${data.currentSeason} total`, width: 18, align: 'right' },
    { key: 'prevPa', label: 'Prev /acre', width: 14, align: 'right' },
    { key: 'currPa', label: 'Curr /acre', width: 14, align: 'right' },
    { key: 'cagr', label: 'CAGR', width: 12, align: 'right' },
  ];
  const poolRows = data.costPoolTrends.map((p) => {
    const prev = p.perSeason.find((s) => s.seasonLabel === data.previousSeason);
    const curr = p.perSeason.find((s) => s.seasonLabel === data.currentSeason);
    return {
      pool: p.costPool.replace(/_/g, ' '),
      prev: fmtPdfMoney(prev?.totalPkr ?? 0),
      curr: fmtPdfMoney(curr?.totalPkr ?? 0),
      prevPa: fmtPdfMoney(prev?.perAcrePkr ?? 0),
      currPa: fmtPdfMoney(curr?.perAcrePkr ?? 0),
      cagr: `${p.cagr.toFixed(1)} %`,
    };
  });

  return (
    <ReportShell
      title={`Year-on-year, ${data.currentSeason} vs ${data.previousSeason}`}
      entityName={entityName}
      period={`${data.previousSeason} → ${data.currentSeason}`}
      generatedAt={generatedAt}
      generatedBy={generatedBy}
      orientation="landscape"
    >
      <SectionTitlePdf>1. Headline totals</SectionTitlePdf>
      <View style={{ flexDirection: 'row', gap: 18, marginTop: 4 }}>
        <KV label="Revenue" value={fmtPdfMoney(data.totalsCurrent.revenuePkr)} delta={fmtPct(data.totalsDelta.revenuePct)} />
        <KV label="Cost" value={fmtPdfMoney(data.totalsCurrent.totalCostPkr)} delta={fmtPct(data.totalsDelta.costPct)} />
        <KV label="Margin" value={fmtPdfMoney(data.totalsCurrent.marginPkr)} delta={fmtPct(data.totalsDelta.marginPct)} />
        <KV
          label="Weighted yield/acre"
          value={`${fmtPdfQty(data.totalsCurrent.weightedYieldPerAcreKg, 0)} kg`}
          delta={fmtPct(data.totalsDelta.yieldPct)}
        />
      </View>

      <SectionTitlePdf>2. Per-crop comparison</SectionTitlePdf>
      <SimpleTable columns={cols} rows={rows} />

      <SectionTitlePdf>3. Cost-pool trend</SectionTitlePdf>
      {poolRows.length === 0 ? (
        <Text style={styles.note}>No cost allocations in selected seasons.</Text>
      ) : (
        <SimpleTable columns={poolCols} rows={poolRows} />
      )}
    </ReportShell>
  );
}

function KV({ label, value, delta }: { label: string; value: string; delta: string }): React.ReactElement {
  return (
    <View>
      <Text style={{ fontSize: 7, letterSpacing: 1, color: BRAND.ochre, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 11, color: BRAND.green, fontWeight: 600, marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 8, color: BRAND.inkMuted, marginTop: 1 }}>{delta}</Text>
    </View>
  );
}
