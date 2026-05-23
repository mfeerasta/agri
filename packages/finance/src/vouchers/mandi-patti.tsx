import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { BRAND, PAGE_SIZE, voucherStyles as s, type WatermarkVariant } from './voucher-styles.js';
import { amountInWordsEn, amountInWordsUr } from './amount-in-words.js';

export interface MandiPattiDeduction {
  label: string;
  labelUr?: string;
  amountRupees: number;
}

export interface MandiPattiProps {
  voucherNumber: string;
  entityName: string;
  entityNameUr?: string;
  lotNumber: string;
  cropName: string;
  cropNameUr?: string;
  mandiName: string;
  arhtiName?: string;
  buyerName?: string;
  settledOn: string;
  weightMann: number;
  weightKg: number;
  ratePerMannRupees: number;
  grossRupees: number;
  deductions: MandiPattiDeduction[];
  netRupees: number;
  watermark?: WatermarkVariant;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function MandiPatti(props: MandiPattiProps): React.JSX.Element {
  const {
    voucherNumber, entityName, entityNameUr, lotNumber, cropName, cropNameUr, mandiName,
    arhtiName, buyerName, settledOn, weightMann, weightKg, ratePerMannRupees,
    grossRupees, deductions, netRupees, watermark = null,
  } = props;

  return (
    <Document title={`Mandi Patti ${voucherNumber}`}>
      <Page size={PAGE_SIZE} style={s.page}>
        {watermark ? <Text style={s.watermark} fixed>{watermark}</Text> : null}

        <View style={s.header}>
          <View>
            <Text style={s.brand}>Zameen · Rupafab Agri</Text>
            <Text style={s.org}>{entityName}</Text>
            {entityNameUr ? <Text style={s.orgSub}>{entityNameUr}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titleUr}>منڈی پتی</Text>
            <Text style={s.titleEn}>MANDI PATTI</Text>
          </View>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Patti No · نمبر</Text>
            <Text style={s.metaValue}>{voucherNumber}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Lot No · لاٹ</Text>
            <Text style={s.metaValue}>{lotNumber}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Settled On · تاریخ</Text>
            <Text style={s.metaValue}>{settledOn}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.label}>Crop · فصل</Text>
            <Text style={s.value}>{cropName}{cropNameUr ? `  ·  ${cropNameUr}` : ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Mandi · منڈی</Text>
            <Text style={s.value}>{mandiName}</Text>
          </View>
          {arhtiName ? (
            <View style={s.row}>
              <Text style={s.label}>Arhti · آڑھتی</Text>
              <Text style={s.value}>{arhtiName}</Text>
            </View>
          ) : null}
          {buyerName ? (
            <View style={s.row}>
              <Text style={s.label}>Buyer · خریدار</Text>
              <Text style={s.value}>{buyerName}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '34%' }]}>Quantity · مقدار</Text>
            <Text style={[s.th, { flexBasis: '22%', textAlign: 'right' }]}>Mann · من</Text>
            <Text style={[s.th, { flexBasis: '22%', textAlign: 'right' }]}>Kg · کلو</Text>
            <Text style={[s.th, { flexBasis: '22%', textAlign: 'right' }]}>Rate/Mann</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '34%' }]}>Weight · وزن</Text>
            <Text style={[s.tdRight, { flexBasis: '22%' }]}>{weightMann.toFixed(2)}</Text>
            <Text style={[s.tdRight, { flexBasis: '22%' }]}>{weightKg.toFixed(2)}</Text>
            <Text style={[s.tdRight, { flexBasis: '22%' }]}>{fmt(ratePerMannRupees)}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '70%' }]}>Description · تفصیل</Text>
            <Text style={[s.th, { flexBasis: '30%', textAlign: 'right' }]}>PKR</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '70%' }]}>Gross sale · کل فروخت</Text>
            <Text style={[s.tdRight, { flexBasis: '30%' }]}>{fmt(grossRupees)}</Text>
          </View>
          {deductions.map((d, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.td, { flexBasis: '70%' }]}>{d.label}{d.labelUr ? `  ·  ${d.labelUr}` : ''}</Text>
              <Text style={[s.tdRight, { flexBasis: '30%' }]}>({fmt(d.amountRupees)})</Text>
            </View>
          ))}
          <View style={s.tableTotalRow}>
            <Text style={[s.tdBold, { flexBasis: '70%' }]}>Net received · خالص رقم</Text>
            <Text style={[s.tdBold, { flexBasis: '30%', textAlign: 'right' }]}>{fmt(netRupees)}</Text>
          </View>
        </View>

        <View style={s.amountBox}>
          <Text style={s.metaLabel}>Net Amount In Words · رقم الفاظ میں</Text>
          <Text style={s.amountWords}>{amountInWordsEn(netRupees)}</Text>
          <Text style={s.amountWordsUr}>{amountInWordsUr(netRupees)}</Text>
        </View>

        <View style={s.signaturesRow}>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Arhti · آڑھتی</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Farm Rep · فارم نمائندہ</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Cashier · خزانچی</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Mandi Patti · منڈی پتی</Text>
          <Text>{mandiName}</Text>
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
