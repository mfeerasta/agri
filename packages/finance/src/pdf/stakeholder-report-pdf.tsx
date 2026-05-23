import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr } from '../statements/pdf/statement-styles.js';
import type { StakeholderReportSnapshot } from '../stakeholder-reporting.js';

export interface StakeholderReportPdfProps {
  snapshot: StakeholderReportSnapshot;
  coverLetter?: string;
}

function KpiTable({ snapshot }: { snapshot: StakeholderReportSnapshot }) {
  if (snapshot.kpis.length === 0) {
    return <Text style={s.period}>No KPI actuals for this period.</Text>;
  }
  return (
    <View>
      {snapshot.kpis.map((k, i) => (
        <View key={k.code} style={i % 2 === 0 ? s.row : s.rowAlt}>
          <Text style={s.cellCode}>{k.category}</Text>
          <Text style={s.cellLabel}>
            {k.name} ({k.unit})
            {k.targetValue != null ? `  target ${k.targetValue}` : ''}
          </Text>
          <Text style={s.cellAmount}>
            {k.value.toLocaleString('en-PK')}
            {k.variancePct != null ? `  (${k.variancePct}%)` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LenderBlock({ snapshot }: { snapshot: StakeholderReportSnapshot }) {
  const l = snapshot.lender;
  if (!l) return null;
  return (
    <View>
      <Text style={s.sectionTitle}>Lender Covenants · قرض دہندہ شرائط</Text>
      <View style={s.row}>
        <Text style={s.cellLabel}>Exposure</Text>
        <Text style={s.cellAmount}>{l.exposurePkr == null ? '—' : fmtPkr(l.exposurePkr)}</Text>
      </View>
      <View style={s.rowAlt}>
        <Text style={s.cellLabel}>Current ratio</Text>
        <Text style={s.cellAmount}>{l.currentRatio == null ? '—' : l.currentRatio.toFixed(2)}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.cellLabel}>Debt service coverage</Text>
        <Text style={s.cellAmount}>{l.debtServiceCoverage == null ? '—' : l.debtServiceCoverage.toFixed(2)}</Text>
      </View>
      {l.notes.map((n, i) => (
        <Text key={i} style={s.period}>Note: {n}</Text>
      ))}
    </View>
  );
}

function GrantBlock({ snapshot }: { snapshot: StakeholderReportSnapshot }) {
  const g = snapshot.grant;
  if (!g) return null;
  return (
    <View>
      <Text style={s.sectionTitle}>Grant Milestones · گرانٹ سنگ میل</Text>
      {g.milestones.length === 0 ? (
        <Text style={s.period}>No milestones declared.</Text>
      ) : (
        g.milestones.map((m, i) => (
          <View key={i} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={s.cellLabel}>{m.label}</Text>
            <Text style={s.cellAmount}>{m.status}</Text>
          </View>
        ))
      )}
      <View style={s.subtotalRow}>
        <Text style={s.subtotalLabel}>Funds utilised</Text>
        <Text style={s.subtotalAmount}>{fmtPkr(g.fundsUtilisedPkr)}</Text>
      </View>
      {g.fundsRemainingPkr != null && (
        <View style={s.subtotalRow}>
          <Text style={s.subtotalLabel}>Funds remaining</Text>
          <Text style={s.subtotalAmount}>{fmtPkr(g.fundsRemainingPkr)}</Text>
        </View>
      )}
    </View>
  );
}

function ImpactBlock({ snapshot }: { snapshot: StakeholderReportSnapshot }) {
  const i = snapshot.impactInvestor;
  if (!i) return null;
  return (
    <View>
      <Text style={s.sectionTitle}>Impact & ESG · اثرات</Text>
      <View style={s.row}>
        <Text style={s.cellLabel}>Net CO2e (latest)</Text>
        <Text style={s.cellAmount}>{i.esg.netCo2eTons == null ? '—' : `${i.esg.netCo2eTons.toFixed(2)} t`}</Text>
      </View>
      <View style={s.rowAlt}>
        <Text style={s.cellLabel}>Active regen practices</Text>
        <Text style={s.cellAmount}>{i.esg.activePractices}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.cellLabel}>Women employment share</Text>
        <Text style={s.cellAmount}>{i.scale.womenSharePct == null ? '—' : `${i.scale.womenSharePct}%`}</Text>
      </View>
    </View>
  );
}

function GovernmentBlock({ snapshot }: { snapshot: StakeholderReportSnapshot }) {
  const g = snapshot.government;
  if (!g) return null;
  return (
    <View>
      <Text style={s.sectionTitle}>Government Disclosures · حکومتی اعدادوشمار</Text>
      <View style={s.row}>
        <Text style={s.cellLabel}>Agri output (yield per acre)</Text>
        <Text style={s.cellAmount}>{g.agriOutputKg == null ? '—' : g.agriOutputKg.toLocaleString('en-PK')}</Text>
      </View>
    </View>
  );
}

export function StakeholderReportPdf({ snapshot, coverLetter }: StakeholderReportPdfProps): React.JSX.Element {
  const { stakeholder, entity, periodStart, periodEnd } = snapshot;
  return (
    <Document title={`Stakeholder Report ${stakeholder.name} ${periodStart} to ${periodEnd}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri</Text>
          <Text style={s.org}>{entity.name}</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>Stakeholder Report</Text>
            <Text style={s.titleUr}>اسٹیک ہولڈر رپورٹ</Text>
          </View>
          <Text style={s.period}>
            {stakeholder.name} · {stakeholder.kind} · {periodStart} to {periodEnd}
          </Text>
        </View>

        {coverLetter ? (
          <View>
            <Text style={s.sectionTitle}>Cover Letter</Text>
            <Text style={s.cellLabel}>{coverLetter}</Text>
          </View>
        ) : null}

        {snapshot.income ? (
          <View>
            <Text style={s.sectionTitle}>Financial Summary · مالی خلاصہ</Text>
            <View style={s.row}>
              <Text style={s.cellLabel}>Revenue</Text>
              <Text style={s.cellAmount}>{fmtPkr(snapshot.income.revenue.subtotalRupees)}</Text>
            </View>
            <View style={s.rowAlt}>
              <Text style={s.cellLabel}>Expenses</Text>
              <Text style={s.cellAmount}>{fmtPkr(snapshot.income.expenses.subtotalRupees)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Net Income · خالص منافع</Text>
              <Text style={s.totalAmount}>{fmtPkr(snapshot.income.netIncomeRupees)}</Text>
            </View>
          </View>
        ) : null}

        <LenderBlock snapshot={snapshot} />
        <GrantBlock snapshot={snapshot} />
        <ImpactBlock snapshot={snapshot} />
        <GovernmentBlock snapshot={snapshot} />

        <Text style={s.sectionTitle}>Key Performance Indicators · کلیدی اشارے</Text>
        <KpiTable snapshot={snapshot} />

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Stakeholder Report</Text>
          <Text>Generated {snapshot.generatedAt.slice(0, 10)}</Text>
        </View>
      </Page>
    </Document>
  );
}
