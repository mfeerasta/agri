import * as React from 'react';
import { View, Text } from '@react-pdf/renderer';
import {
  ReportShell,
  SimpleTable,
  SectionTitlePdf,
  fmtPdfMoney,
  fmtPdfQty,
  BRAND,
  type ColumnSpec,
} from './report-template';
import type { FieldPnL } from '@zameen/finance';

export interface FieldPnlPdfProps {
  pnls: FieldPnL[];
  costPools: string[];
  fieldCodeById: Record<string, string>;
  entityName: string;
  generatedBy: string;
  title: string;
  period: string;
  generatedAt?: Date;
}

export function FieldPnlPdf(props: FieldPnlPdfProps): React.ReactElement {
  const { pnls, costPools, fieldCodeById, entityName, generatedBy, title, period, generatedAt } = props;

  const cols: ColumnSpec[] = [
    { key: 'fieldCode', label: 'Field', width: 10, mono: true },
    { key: 'crop', label: 'Crop', width: 18 },
    { key: 'acres', label: 'Acres', width: 8, align: 'right' },
    { key: 'yield', label: 'Yield kg', width: 12, align: 'right' },
    { key: 'rev', label: 'Revenue', width: 14, align: 'right' },
    { key: 'cost', label: 'Cost', width: 13, align: 'right' },
    { key: 'margin', label: 'Margin', width: 13, align: 'right' },
    { key: 'mpa', label: 'Margin / acre', width: 12, align: 'right' },
  ];

  const rows = pnls.map((p) => ({
    fieldCode: fieldCodeById[p.fieldId] ?? p.fieldId.slice(0, 8),
    crop: p.cropName,
    acres: fmtPdfQty(p.acres),
    yield: fmtPdfQty(p.yieldKg, 0),
    rev: fmtPdfMoney(p.revenuePkr),
    cost: fmtPdfMoney(p.totalCostPkr),
    margin: fmtPdfMoney(p.grossMarginPkr),
    mpa: fmtPdfMoney(p.marginPerAcrePkr),
  }));

  const totals = pnls.reduce(
    (a, p) => ({
      acres: a.acres + p.acres,
      yieldKg: a.yieldKg + p.yieldKg,
      rev: a.rev + p.revenuePkr,
      cost: a.cost + p.totalCostPkr,
      margin: a.margin + p.grossMarginPkr,
    }),
    { acres: 0, yieldKg: 0, rev: 0, cost: 0, margin: 0 },
  );

  const poolCols: ColumnSpec[] = [
    { key: 'fieldCode', label: 'Field', width: 14, mono: true },
    ...costPools.map((p) => ({
      key: `pool_${p}`,
      label: p.replace(/_/g, ' '),
      width: Math.max(10, Math.floor(86 / Math.max(1, costPools.length))),
      align: 'right' as const,
    })),
  ];
  const poolRows = pnls.map((p) => {
    const row: Record<string, string> = { fieldCode: fieldCodeById[p.fieldId] ?? p.fieldId.slice(0, 8) };
    for (const pool of costPools) row[`pool_${pool}`] = fmtPdfMoney(p.costByPool[pool] ?? 0);
    return row;
  });

  return (
    <ReportShell
      title={title}
      entityName={entityName}
      period={period}
      generatedAt={generatedAt}
      generatedBy={generatedBy}
      orientation="landscape"
    >
      <SectionTitlePdf>Field P&amp;L</SectionTitlePdf>
      <SimpleTable
        columns={cols}
        rows={rows}
        totals={{
          fieldCode: '',
          crop: '',
          acres: fmtPdfQty(totals.acres),
          yield: fmtPdfQty(totals.yieldKg, 0),
          rev: fmtPdfMoney(totals.rev),
          cost: fmtPdfMoney(totals.cost),
          margin: fmtPdfMoney(totals.margin),
          mpa: fmtPdfMoney(totals.acres > 0 ? totals.margin / totals.acres : 0),
        }}
        totalsLabel="TOTAL"
      />

      {costPools.length > 0 ? (
        <>
          <SectionTitlePdf>Cost-pool breakdown</SectionTitlePdf>
          <SimpleTable columns={poolCols} rows={poolRows} />
        </>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 8, color: BRAND.inkMuted }}>No cost allocations posted.</Text>
        </View>
      )}
    </ReportShell>
  );
}
