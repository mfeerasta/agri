import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr } from './statement-styles.js';

export interface StrategicPlanPdfInitiative {
  name: string;
  category: string;
  startYear: number;
  endYear: number;
  estimatedInvestmentPkr: number;
  expectedReturnPkr: number;
  expectedIrrPct: number | null;
  paybackYears: number | null;
  priority: string;
  status: string;
}

export interface StrategicPlanPdfRotation {
  fieldLabel: string;
  byYear: Record<number, string>;
}

export interface StrategicPlanPdfSimulation {
  scenarioName: string;
  npvPkr: number;
  irrPct: number | null;
  paybackYears: number | null;
  yearly: { year: number; netCashFlowPkr: number; cumulativeCashPkr: number }[];
  sensitivity?: { label: string; npvPkr: number }[];
}

export interface StrategicPlanPdfProps {
  entityName: string;
  planName: string;
  startYear: number;
  horizonYears: number;
  visionStatement: string | null;
  initiatives: StrategicPlanPdfInitiative[];
  rotations: StrategicPlanPdfRotation[];
  topSimulation: StrategicPlanPdfSimulation | null;
}

export function StrategicPlanPdf({
  entityName,
  planName,
  startYear,
  horizonYears,
  visionStatement,
  initiatives,
  rotations,
  topSimulation,
}: StrategicPlanPdfProps): React.JSX.Element {
  const years = Array.from({ length: horizonYears }, (_, i) => startYear + i);
  const totalInvestment = initiatives.reduce((sum, i) => sum + i.estimatedInvestmentPkr, 0);
  const totalReturn = initiatives.reduce((sum, i) => sum + i.expectedReturnPkr, 0);

  return (
    <Document title={`5-Year Strategic Plan ${planName}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri</Text>
          <Text style={s.org}>{entityName}</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>5-Year Strategic Plan</Text>
            <Text style={s.titleUr}>پانچ سالہ منصوبہ</Text>
          </View>
          <Text style={s.org}>
            {planName} · Years {startYear}–{startYear + horizonYears - 1}
          </Text>
        </View>

        <View>
          <Text style={s.sectionTitle}>Executive summary</Text>
          {visionStatement && (
            <Text style={{ fontSize: 10, marginVertical: 4 }}>
              Vision: {visionStatement}
            </Text>
          )}
          <View style={s.row}>
            <Text style={s.cellLabel}>Total proposed investment</Text>
            <Text style={s.cellAmount}>{fmtPkr(totalInvestment)}</Text>
          </View>
          <View style={s.rowAlt}>
            <Text style={s.cellLabel}>Total expected return</Text>
            <Text style={s.cellAmount}>{fmtPkr(totalReturn)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cellLabel}>Number of initiatives</Text>
            <Text style={s.cellAmount}>{initiatives.length.toString()}</Text>
          </View>
          {topSimulation && (
            <View style={s.rowAlt}>
              <Text style={s.cellLabel}>Lead scenario NPV ({topSimulation.scenarioName})</Text>
              <Text style={s.cellAmount}>{fmtPkr(topSimulation.npvPkr)}</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={s.sectionTitle}>Initiative roadmap (Gantt)</Text>
          {initiatives.map((i, idx) => (
            <View key={idx} style={idx % 2 === 0 ? s.row : s.rowAlt}>
              <Text style={s.cellLabel}>
                {i.name} ({i.category}, {i.priority})
              </Text>
              <Text style={{ fontSize: 9, width: 110 }}>
                {i.startYear}–{i.endYear}
              </Text>
              <Text style={s.cellAmount}>{fmtPkr(i.estimatedInvestmentPkr)}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={s.sectionTitle}>Crop rotation map</Text>
          <View style={s.row}>
            <Text style={s.cellLabel}>Field</Text>
            {years.map((y) => (
              <Text key={y} style={{ fontSize: 8, width: 45, textAlign: 'center' }}>
                {y}
              </Text>
            ))}
          </View>
          {rotations.map((r, idx) => (
            <View key={idx} style={idx % 2 === 0 ? s.row : s.rowAlt}>
              <Text style={s.cellLabel}>{r.fieldLabel}</Text>
              {years.map((y) => (
                <Text key={y} style={{ fontSize: 8, width: 45, textAlign: 'center' }}>
                  {r.byYear[y] ?? '—'}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {topSimulation && (
          <View style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.sectionTitle}>Financial projections — {topSimulation.scenarioName}</Text>
            <View style={s.row}>
              <Text style={s.cellLabel}>Year</Text>
              <Text style={s.cellAmount}>Net cash</Text>
              <Text style={s.cellAmount}>Cumulative</Text>
            </View>
            {topSimulation.yearly.map((y, idx) => (
              <View key={y.year} style={idx % 2 === 0 ? s.row : s.rowAlt}>
                <Text style={s.cellLabel}>{y.year.toString()}</Text>
                <Text style={s.cellAmount}>{fmtPkr(y.netCashFlowPkr)}</Text>
                <Text style={s.cellAmount}>{fmtPkr(y.cumulativeCashPkr)}</Text>
              </View>
            ))}
            <View style={s.subtotalRow}>
              <Text style={s.subtotalLabel}>NPV / IRR / Payback</Text>
              <Text style={s.subtotalAmount}>
                {fmtPkr(topSimulation.npvPkr)} / {topSimulation.irrPct?.toFixed(2) ?? '—'}% /{' '}
                {topSimulation.paybackYears?.toFixed(2) ?? '—'} yrs
              </Text>
            </View>
            {topSimulation.sensitivity && topSimulation.sensitivity.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <Text style={s.sectionTitle}>Sensitivity analysis</Text>
                {topSimulation.sensitivity.map((sn, idx) => (
                  <View key={idx} style={idx % 2 === 0 ? s.row : s.rowAlt}>
                    <Text style={s.cellLabel}>{sn.label}</Text>
                    <Text style={s.cellAmount}>{fmtPkr(sn.npvPkr)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}
