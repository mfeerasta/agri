import * as React from 'react';
import {
  ReportShell,
  SimpleTable,
  SectionTitlePdf,
  fmtPdfMoney,
  type ColumnSpec,
} from './report-template';
import type { FieldMatrix } from './field-matrix';

export interface FieldMatrixPdfProps {
  matrix: FieldMatrix;
  entityName: string;
  generatedBy: string;
  generatedAt?: Date;
}

export function FieldMatrixPdf({ matrix, entityName, generatedBy, generatedAt }: FieldMatrixPdfProps): React.ReactElement {
  const seasonWidth = Math.max(8, Math.floor(82 / Math.max(1, matrix.seasons.length)));
  const cols: ColumnSpec[] = [
    { key: 'fieldCode', label: 'Field', width: 10, mono: true },
    { key: 'acres', label: 'Acres', width: 8, align: 'right' },
    ...matrix.seasons.map((s) => ({
      key: `season_${s}`,
      label: s,
      width: seasonWidth,
      align: 'right' as const,
    })),
  ];

  const rows = matrix.rows.map((r) => {
    const base: Record<string, string> = { fieldCode: r.fieldCode, acres: r.acres.toFixed(1) };
    for (const s of matrix.seasons) {
      base[`season_${s}`] = r.cells[s] ? fmtPdfMoney(r.cells[s]!.marginPerAcre) : '—';
    }
    return base;
  });

  return (
    <ReportShell
      title={`Field margin/acre matrix, last ${matrix.seasons.length} seasons`}
      entityName={entityName}
      period={matrix.seasons.length ? `${matrix.seasons[0]!} → ${matrix.seasons[matrix.seasons.length - 1]!}` : 'n.a.'}
      generatedAt={generatedAt}
      generatedBy={generatedBy}
      orientation="landscape"
    >
      <SectionTitlePdf>Margin per acre (PKR)</SectionTitlePdf>
      <SimpleTable columns={cols} rows={rows} />
    </ReportShell>
  );
}
