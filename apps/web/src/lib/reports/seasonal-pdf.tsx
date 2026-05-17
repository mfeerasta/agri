import * as React from 'react';
import { View, Text } from '@react-pdf/renderer';
import {
  ReportShell,
  SimpleTable,
  SectionTitlePdf,
  fmtPdfMoney,
  fmtPdfQty,
  fmtPdfDateTime,
  styles,
  BRAND,
  type ColumnSpec,
} from './report-template';
import type { SeasonalReportData } from './seasonal-report';

export interface SeasonalPdfProps {
  data: SeasonalReportData;
  entityName: string;
  generatedBy: string;
  generatedAt?: Date;
}

export function SeasonalReportPdf({ data, entityName, generatedBy, generatedAt }: SeasonalPdfProps): React.ReactElement {
  const pnlCols: ColumnSpec[] = [
    { key: 'fieldCode', label: 'Field', width: 8, mono: true },
    { key: 'cropName', label: 'Crop', width: 16 },
    { key: 'acres', label: 'Acres', width: 8, align: 'right' },
    { key: 'yieldKg', label: 'Yield kg', width: 11, align: 'right' },
    { key: 'revenue', label: 'Revenue', width: 14, align: 'right' },
    { key: 'cost', label: 'Cost', width: 14, align: 'right' },
    { key: 'margin', label: 'Margin', width: 14, align: 'right' },
    { key: 'mpa', label: 'Margin / acre', width: 15, align: 'right' },
  ];

  const pnlRows = data.rows.map((r) => ({
    fieldCode: r.fieldCode,
    cropName: r.cropName,
    acres: fmtPdfQty(r.acres),
    yieldKg: fmtPdfQty(r.yieldKg, 0),
    revenue: fmtPdfMoney(r.revenuePkr),
    cost: fmtPdfMoney(r.totalCostPkr),
    margin: fmtPdfMoney(r.grossMarginPkr),
    mpa: fmtPdfMoney(r.marginPerAcrePkr),
  }));

  const pnlTotals = {
    fieldCode: '',
    cropName: '',
    acres: fmtPdfQty(data.totals.acres),
    yieldKg: fmtPdfQty(data.totals.yieldKg, 0),
    revenue: fmtPdfMoney(data.totals.revenuePkr),
    cost: fmtPdfMoney(data.totals.totalCostPkr),
    margin: fmtPdfMoney(data.totals.grossMarginPkr),
    mpa: fmtPdfMoney(data.totals.weightedMarginPerAcrePkr),
  };

  // Section 2: cost-pool table. Columns: field + each pool.
  const poolCols: ColumnSpec[] = [
    { key: 'fieldCode', label: 'Field', width: 14, mono: true },
    ...data.costPools.map((p) => ({
      key: `pool_${p}`,
      label: p.replace(/_/g, ' '),
      width: Math.max(10, Math.floor(86 / Math.max(1, data.costPools.length))),
      align: 'right' as const,
    })),
  ];

  const poolRows = data.rows.map((r) => {
    const row: Record<string, string> = { fieldCode: r.fieldCode };
    for (const p of data.costPools) row[`pool_${p}`] = fmtPdfMoney(r.costByPool[p] ?? 0);
    return row;
  });

  // Section 3: yield variance
  const varCols: ColumnSpec[] = [
    { key: 'fieldCode', label: 'Field', width: 10, mono: true },
    { key: 'cropName', label: 'Crop', width: 22 },
    { key: 'actual', label: 'Actual kg / acre', width: 20, align: 'right' },
    { key: 'benchmark', label: 'Benchmark kg / acre', width: 22, align: 'right' },
    { key: 'delta', label: 'Delta %', width: 14, align: 'right' },
  ];
  const varRows = data.rows.map((r) => ({
    fieldCode: r.fieldCode,
    cropName: r.cropName,
    actual: fmtPdfQty(r.yieldPerAcreKg, 0),
    benchmark: r.benchmarkPerAcre !== null ? fmtPdfQty(r.benchmarkPerAcre, 0) : 'n.a.',
    delta: r.variancePct !== null ? `${r.variancePct.toFixed(1)} %` : 'n.a.',
  }));

  return (
    <ReportShell
      title={`Seasonal Review, ${data.seasonLabel}`}
      entityName={entityName}
      period={data.seasonLabel}
      generatedAt={generatedAt}
      generatedBy={generatedBy}
      orientation="landscape"
    >
      <SectionTitlePdf>1. Per-field P&amp;L</SectionTitlePdf>
      <SimpleTable columns={pnlCols} rows={pnlRows} totals={pnlTotals} totalsLabel="TOTAL" />

      <SectionTitlePdf>2. Cost-pool breakdown</SectionTitlePdf>
      {data.costPools.length === 0 ? (
        <Text style={styles.note}>No cost allocations posted in this season.</Text>
      ) : (
        <SimpleTable columns={poolCols} rows={poolRows} />
      )}

      <SectionTitlePdf>3. Yield variance vs benchmark</SectionTitlePdf>
      <SimpleTable columns={varCols} rows={varRows} />

      <SectionTitlePdf>4. Season totals</SectionTitlePdf>
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 4 }}>
        <KeyValueCol label="Total revenue" value={fmtPdfMoney(data.totals.revenuePkr)} />
        <KeyValueCol label="Total cost" value={fmtPdfMoney(data.totals.totalCostPkr)} />
        <KeyValueCol label="Total margin" value={fmtPdfMoney(data.totals.grossMarginPkr)} />
        <KeyValueCol
          label="Weighted margin / acre"
          value={fmtPdfMoney(data.totals.weightedMarginPerAcrePkr)}
        />
      </View>

      <SectionTitlePdf>5. Decisions and notes</SectionTitlePdf>
      {data.decisions.length === 0 ? (
        <Text style={styles.note}>No crop-sale or feasibility-study approvals recorded this season.</Text>
      ) : (
        <View>
          {data.decisions.map((d, i) => (
            <View key={i} style={{ marginBottom: 5 }} wrap={false}>
              <Text style={{ fontSize: 8.5, color: BRAND.green, fontWeight: 600 }}>
                {d.title} ({d.approvalType.replace(/_/g, ' ')})
              </Text>
              <Text style={{ fontSize: 8, color: BRAND.inkMuted }}>
                {fmtPdfDateTime(d.occurredAt)}, {d.actorRole}, {d.action}
              </Text>
              {d.comment ? (
                <Text style={{ fontSize: 8.5, marginTop: 1 }}>{d.comment}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ReportShell>
  );
}

function KeyValueCol({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View>
      <Text style={{ fontSize: 7, letterSpacing: 1, color: BRAND.ochre, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 11, color: BRAND.green, fontWeight: 600, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
