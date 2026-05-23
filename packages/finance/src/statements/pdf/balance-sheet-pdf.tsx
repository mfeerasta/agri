import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { stmtStyles as s, fmtPkr, STMT_BRAND } from './statement-styles.js';
import type { BalanceSheet, StatementSection } from '../types.js';

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

export interface BalanceSheetPdfProps {
  entityName: string;
  entityNameUr?: string;
  data: BalanceSheet;
}

export function BalanceSheetPdf({ entityName, entityNameUr, data }: BalanceSheetPdfProps): React.JSX.Element {
  return (
    <Document title={`Balance Sheet ${data.asOf}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>Zameen · Rupafab Agri</Text>
          <Text style={s.org}>{entityName}{entityNameUr ? `  ·  ${entityNameUr}` : ''}</Text>
          <View style={s.titleRow}>
            <Text style={s.titleEn}>Balance Sheet</Text>
            <Text style={s.titleUr}>گوشوارہ مالیات</Text>
          </View>
          <Text style={s.period}>As of · بتاریخ {data.asOf}</Text>
        </View>

        <Section section={data.assets} />
        <Section section={data.liabilities} />
        <Section section={data.equity} />

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Liabilities + Equity · کل واجبات + سرمایہ</Text>
          <Text style={s.totalAmount}>{fmtPkr(data.totalLiabEqRupees)}</Text>
        </View>
        <View style={[s.totalRow, { backgroundColor: data.balanced ? STMT_BRAND.softBg : '#FBE7E7' }]}>
          <Text style={s.totalLabel}>Total Assets · کل اثاثے</Text>
          <Text style={s.totalAmount}>{fmtPkr(data.assets.subtotalRupees)}</Text>
        </View>
        {!data.balanced ? (
          <Text style={{ marginTop: 8, fontSize: 10, color: '#B00020' }}>
            Statement does not balance. Assets minus (Liabilities + Equity) = {fmtPkr(data.assets.subtotalRupees - data.totalLiabEqRupees)}
          </Text>
        ) : null}

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Balance Sheet</Text>
          <Text>As of {data.asOf}</Text>
        </View>
      </Page>
    </Document>
  );
}
