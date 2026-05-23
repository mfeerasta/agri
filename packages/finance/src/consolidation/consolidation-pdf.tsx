import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr } from '../statements/pdf/statement-styles.js';
import type { ConsolidatedReport } from './consolidate.js';
import type { StatementSection } from '../statements/types.js';

function Section({ section }: { section: StatementSection }): React.JSX.Element {
  return (
    <View>
      <Text style={s.sectionTitle}>{section.title.en}  ·  {section.title.ur}</Text>
      {section.lines.map((l, i) => (
        <View key={i} style={i % 2 === 0 ? s.row : s.rowAlt}>
          <Text style={s.cellCode}>{l.accountCode ?? ''}</Text>
          <Text style={s.cellLabel}>{l.label.en}  ·  {l.label.ur}</Text>
          <Text style={s.cellAmount}>{fmtPkr(l.amountRupees)}</Text>
        </View>
      ))}
      <View style={s.subtotalRow}>
        <Text style={s.subtotalLabel}>Subtotal · ذیلی کل</Text>
        <Text style={s.subtotalAmount}>{fmtPkr(section.subtotalRupees)}</Text>
      </View>
    </View>
  );
}

export interface ConsolidationPdfProps {
  parentEntityName: string;
  report: ConsolidatedReport;
}

export function ConsolidationPdf({ parentEntityName, report }: ConsolidationPdfProps): React.JSX.Element {
  const c = report.consolidated;
  return (
    <Document title={`Consolidated Statements ${report.periodEnd}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri Group</Text>
          <Text style={s.org}>{parentEntityName} (Consolidated)</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>Consolidated Statements</Text>
            <Text style={s.titleUr}>مجموعی گوشوارے</Text>
          </View>
          <Text style={s.period}>
            Period · مدت {report.periodStart} to {report.periodEnd} · {report.perEntity.length} entities · {report.eliminationsApplied.length} eliminations
          </Text>
        </View>

        <Text style={s.sectionTitle}>Balance Sheet · گوشوارہ مالیات</Text>
        <Section section={c.balanceSheet.assets} />
        <Section section={c.balanceSheet.liabilities} />
        <Section section={c.balanceSheet.equity} />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Liab + Equity</Text>
          <Text style={s.totalAmount}>{fmtPkr(c.balanceSheet.totalLiabEqRupees)}</Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Income Statement · گوشوارہ آمدنی</Text>
        <Section section={c.incomeStatement.revenue} />
        <Section section={c.incomeStatement.expenses} />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Net Income · خالص آمدنی</Text>
          <Text style={s.totalAmount}>{fmtPkr(c.incomeStatement.netIncomeRupees)}</Text>
        </View>

        <Text style={s.sectionTitle}>Cash Flow · بہاؤِ نقد</Text>
        <Section section={c.cashFlow.operating} />
        <Section section={c.cashFlow.investing} />
        <Section section={c.cashFlow.financing} />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Net Change in Cash</Text>
          <Text style={s.totalAmount}>{fmtPkr(c.cashFlow.netChangeRupees)}</Text>
        </View>
        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Consolidation</Text>
          <Text>{report.periodEnd}</Text>
        </View>
      </Page>
    </Document>
  );
}
