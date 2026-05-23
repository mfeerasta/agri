import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr } from './statement-styles.js';
import type { IncomeStatement, StatementSection } from '../types.js';

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
        <Text style={s.subtotalLabel}>Total · کل</Text>
        <Text style={s.subtotalAmount}>{fmtPkr(section.subtotalRupees)}</Text>
      </View>
    </View>
  );
}

export interface IncomeStatementPdfProps {
  entityName: string;
  entityNameUr?: string;
  data: IncomeStatement;
}

export function IncomeStatementPdf({ entityName, entityNameUr, data }: IncomeStatementPdfProps): React.JSX.Element {
  return (
    <Document title={`Income Statement ${data.periodStart} to ${data.periodEnd}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri</Text>
          <Text style={s.org}>{entityName}{entityNameUr ? `  ·  ${entityNameUr}` : ''}</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>Income Statement</Text>
            <Text style={s.titleUr}>نفع و نقصان</Text>
          </View>
          <Text style={s.period}>Period · مدت: {data.periodStart} → {data.periodEnd}</Text>
        </View>

        <Section section={data.revenue} />
        <Section section={data.expenses} />

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>
            {data.netIncomeRupees >= 0 ? 'Net Income · خالص منافع' : 'Net Loss · خالص نقصان'}
          </Text>
          <Text style={s.totalAmount}>{fmtPkr(data.netIncomeRupees)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Income Statement</Text>
          <Text>{data.periodStart} → {data.periodEnd}</Text>
        </View>
      </Page>
    </Document>
  );
}
