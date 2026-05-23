import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { BRAND, PAGE_SIZE, voucherStyles as s, type WatermarkVariant } from './voucher-styles.js';

export interface JournalVoucherLine {
  accountCode: string;
  accountName: string;
  accountNameUr?: string;
  debitRupees: number;
  creditRupees: number;
  narration?: string;
}

export interface JournalVoucherProps {
  voucherNumber: string;
  entityName: string;
  entityNameUr?: string;
  postedOn: string;
  lines: JournalVoucherLine[];
  narration: string;
  preparedBy?: string;
  watermark?: WatermarkVariant;
}

function fmt(n: number): string {
  if (n === 0) return '-';
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function JournalVoucher(props: JournalVoucherProps): React.JSX.Element {
  const { voucherNumber, entityName, entityNameUr, postedOn, lines, narration, preparedBy, watermark = null } = props;
  const totalDr = lines.reduce((a, l) => a + l.debitRupees, 0);
  const totalCr = lines.reduce((a, l) => a + l.creditRupees, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.005;

  return (
    <Document title={`Journal Voucher ${voucherNumber}`}>
      <Page size={PAGE_SIZE} style={s.page}>
        {watermark ? <Text style={s.watermark} fixed>{watermark}</Text> : null}

        <View style={s.header}>
          <View>
            <Text style={s.brand}>Zameen · Rupafab Agri</Text>
            <Text style={s.org}>{entityName}</Text>
            {entityNameUr ? <Text style={s.orgSub}>{entityNameUr}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titleEn}>JOURNAL VOUCHER</Text>
            <Text style={s.titleUr}>جنرل واؤچر</Text>
          </View>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Voucher No · نمبر</Text>
            <Text style={s.metaValue}>{voucherNumber}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Date · تاریخ</Text>
            <Text style={s.metaValue}>{postedOn}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Status · حالت</Text>
            <Text style={s.metaValue}>{balanced ? 'Balanced' : 'UNBALANCED'}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '12%' }]}>Code</Text>
            <Text style={[s.th, { flexBasis: '40%' }]}>Account · کھاتہ</Text>
            <Text style={[s.th, { flexBasis: '20%', textAlign: 'right' }]}>Debit · ڈیبٹ</Text>
            <Text style={[s.th, { flexBasis: '20%', textAlign: 'right' }]}>Credit · کریڈٹ</Text>
            <Text style={[s.th, { flexBasis: '8%' }]}> </Text>
          </View>
          {lines.map((l, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.td, { flexBasis: '12%' }]}>{l.accountCode}</Text>
              <Text style={[s.td, { flexBasis: '40%' }]}>
                {l.accountName}{l.accountNameUr ? `  ·  ${l.accountNameUr}` : ''}
                {l.narration ? `\n${l.narration}` : ''}
              </Text>
              <Text style={[s.tdRight, { flexBasis: '20%' }]}>{fmt(l.debitRupees)}</Text>
              <Text style={[s.tdRight, { flexBasis: '20%' }]}>{fmt(l.creditRupees)}</Text>
              <Text style={[s.td, { flexBasis: '8%' }]}> </Text>
            </View>
          ))}
          <View style={s.tableTotalRow}>
            <Text style={[s.tdBold, { flexBasis: '52%' }]}>Total · کل</Text>
            <Text style={[s.tdBold, { flexBasis: '20%', textAlign: 'right' }]}>{fmt(totalDr)}</Text>
            <Text style={[s.tdBold, { flexBasis: '20%', textAlign: 'right' }]}>{fmt(totalCr)}</Text>
            <Text style={[s.td, { flexBasis: '8%' }]}> </Text>
          </View>
        </View>

        <View style={s.narrationBox}>
          <Text style={s.narrationLabel}>Narration · تفصیل</Text>
          <Text style={s.narrationText}>{narration}</Text>
        </View>

        <View style={s.signaturesRow}>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Prepared By · تیار کنندہ</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Checked By · جانچ کنندہ</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Approver · منظوری</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Journal Voucher · جنرل واؤچر</Text>
          <Text>{preparedBy ? `Prepared by ${preparedBy}` : ''}</Text>
        </View>
        <Text
          style={{ position: 'absolute', bottom: 16, right: 32, fontSize: 7, color: BRAND.muted }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
