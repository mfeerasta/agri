import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr } from './statement-styles.js';
import type { CashFlowStatement, StatementSection } from '../types.js';

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
        <Text style={s.subtotalLabel}>Net · خالص</Text>
        <Text style={s.subtotalAmount}>{fmtPkr(section.subtotalRupees)}</Text>
      </View>
    </View>
  );
}

export interface CashFlowPdfProps {
  entityName: string;
  entityNameUr?: string;
  data: CashFlowStatement;
}

export function CashFlowPdf({ entityName, entityNameUr, data }: CashFlowPdfProps): React.JSX.Element {
  return (
    <Document title={`Cash Flow ${data.periodStart} to ${data.periodEnd}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri</Text>
          <Text style={s.org}>{entityName}{entityNameUr ? `  ·  ${entityNameUr}` : ''}</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>Cash Flow Statement</Text>
            <Text style={s.titleUr}>گوشوارہ نقدی</Text>
          </View>
          <Text style={s.period}>Period · مدت: {data.periodStart} → {data.periodEnd}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.cellLabel}>Opening Cash · ابتدائی نقدی</Text>
          <Text style={s.cellAmount}>{fmtPkr(data.openingCashRupees)}</Text>
        </View>

        <Section section={data.operating} />
        <Section section={data.investing} />
        <Section section={data.financing} />

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Net Change in Cash · نقدی میں خالص تبدیلی</Text>
          <Text style={s.totalAmount}>{fmtPkr(data.netChangeRupees)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Closing Cash · اختتامی نقدی</Text>
          <Text style={s.totalAmount}>{fmtPkr(data.closingCashRupees)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Cash Flow Statement</Text>
          <Text>{data.periodStart} → {data.periodEnd}</Text>
        </View>
      </Page>
    </Document>
  );
}
