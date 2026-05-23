import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { BRAND, PAGE_SIZE, voucherStyles as s, type WatermarkVariant } from './voucher-styles.js';

export interface GrnLine {
  itemName: string;
  itemNameUr?: string;
  unit: string;
  qtyOrdered: number;
  qtyReceived: number;
  ratePerUnitRupees: number;
}

export interface GrnVoucherProps {
  voucherNumber: string;
  entityName: string;
  entityNameUr?: string;
  poNumber: string;
  vendorName: string;
  vendorNameUr?: string;
  receivedOn: string;
  warehouseName: string;
  qualityCheckPassed: boolean;
  qcNotes?: string;
  lines: GrnLine[];
  receivedBy?: string;
  watermark?: WatermarkVariant;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function GrnGoodsReceiptNote(props: GrnVoucherProps): React.JSX.Element {
  const {
    voucherNumber, entityName, entityNameUr, poNumber, vendorName, vendorNameUr,
    receivedOn, warehouseName, qualityCheckPassed, qcNotes, lines, receivedBy, watermark = null,
  } = props;

  const totalReceived = lines.reduce((a, l) => a + l.qtyReceived * l.ratePerUnitRupees, 0);

  return (
    <Document title={`GRN ${voucherNumber}`}>
      <Page size={PAGE_SIZE} style={s.page}>
        {watermark ? <Text style={s.watermark} fixed>{watermark}</Text> : null}

        <View style={s.header}>
          <View>
            <Text style={s.brand}>Zameen · Rupafab Agri</Text>
            <Text style={s.org}>{entityName}</Text>
            {entityNameUr ? <Text style={s.orgSub}>{entityNameUr}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titleEn}>GOODS RECEIPT NOTE</Text>
            <Text style={s.titleUr}>مال موصولی رسید</Text>
          </View>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>GRN No · نمبر</Text>
            <Text style={s.metaValue}>{voucherNumber}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Received On · تاریخ</Text>
            <Text style={s.metaValue}>{receivedOn}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>PO Ref · پی او</Text>
            <Text style={s.metaValue}>{poNumber}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.label}>Vendor · فروخت کنندہ</Text>
            <Text style={s.value}>{vendorName}{vendorNameUr ? `  ·  ${vendorNameUr}` : ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Warehouse · گودام</Text>
            <Text style={s.value}>{warehouseName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Quality Check · جانچ</Text>
            <Text style={s.value}>{qualityCheckPassed ? 'PASSED · منظور' : 'FAILED · ناکام'}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '34%' }]}>Item · آئٹم</Text>
            <Text style={[s.th, { flexBasis: '10%' }]}>Unit</Text>
            <Text style={[s.th, { flexBasis: '12%', textAlign: 'right' }]}>Ordered</Text>
            <Text style={[s.th, { flexBasis: '12%', textAlign: 'right' }]}>Received</Text>
            <Text style={[s.th, { flexBasis: '10%', textAlign: 'right' }]}>Short</Text>
            <Text style={[s.th, { flexBasis: '10%', textAlign: 'right' }]}>Rate</Text>
            <Text style={[s.th, { flexBasis: '12%', textAlign: 'right' }]}>Total</Text>
          </View>
          {lines.map((l, i) => {
            const short = Math.max(0, l.qtyOrdered - l.qtyReceived);
            const total = l.qtyReceived * l.ratePerUnitRupees;
            return (
              <View key={i} style={s.tableRow}>
                <Text style={[s.td, { flexBasis: '34%' }]}>
                  {l.itemName}{l.itemNameUr ? `  ·  ${l.itemNameUr}` : ''}
                </Text>
                <Text style={[s.td, { flexBasis: '10%' }]}>{l.unit}</Text>
                <Text style={[s.tdRight, { flexBasis: '12%' }]}>{l.qtyOrdered.toFixed(2)}</Text>
                <Text style={[s.tdRight, { flexBasis: '12%' }]}>{l.qtyReceived.toFixed(2)}</Text>
                <Text style={[s.tdRight, { flexBasis: '10%' }]}>{short.toFixed(2)}</Text>
                <Text style={[s.tdRight, { flexBasis: '10%' }]}>{fmt(l.ratePerUnitRupees)}</Text>
                <Text style={[s.tdRight, { flexBasis: '12%' }]}>{fmt(total)}</Text>
              </View>
            );
          })}
          <View style={s.tableTotalRow}>
            <Text style={[s.tdBold, { flexBasis: '88%' }]}>Total Received Value · کل قیمت</Text>
            <Text style={[s.tdBold, { flexBasis: '12%', textAlign: 'right' }]}>{fmt(totalReceived)}</Text>
          </View>
        </View>

        <View style={s.narrationBox}>
          <Text style={s.narrationLabel}>Condition / QC Notes · حالت اور جانچ</Text>
          <Text style={s.narrationText}>{qcNotes ?? '-'}</Text>
        </View>

        <View style={s.signaturesRow}>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Vendor Rep · فروخت کنندہ</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Storekeeper · سٹور کیپر</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Inspector · معائنہ کار</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Goods Receipt Note · مال موصولی رسید</Text>
          <Text>{receivedBy ? `Received by ${receivedBy}` : ''}</Text>
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
