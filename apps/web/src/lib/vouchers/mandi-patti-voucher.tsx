import * as React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { VoucherShell, AmountBox, SignatureRow, LabelValueRow, vStyles } from './voucher-shell';
import { pkrToWords } from './number-to-words';
import { fmtPdfMoney, fmtPdfQty, BRAND } from '../reports/report-template';
import type { MandiPattiView } from './voucher-data';

export interface MandiPattiVoucherPdfProps {
  patti: MandiPattiView;
  voucherNumber: string;
  entityName: string;
}

export function MandiPattiVoucherPdf({
  patti,
  voucherNumber,
  entityName,
}: MandiPattiVoucherPdfProps): React.ReactElement {
  const net = Number(patti.netReceivedPkr);

  const deductionRows: Array<{ label: string; labelUr: string; value: string }> = [
    { label: 'Commission', labelUr: 'کمیشن', value: fmtPdfMoney(patti.commissionPkr) },
    { label: 'Loading', labelUr: 'لوڈنگ', value: patti.loadingPkr ? fmtPdfMoney(patti.loadingPkr) : '-' },
    { label: 'Weighing', labelUr: 'تولائی', value: patti.weighingPkr ? fmtPdfMoney(patti.weighingPkr) : '-' },
    { label: 'Freight', labelUr: 'کرایہ', value: patti.freightPkr ? fmtPdfMoney(patti.freightPkr) : '-' },
    { label: 'Other deductions', labelUr: 'دیگر کٹوتیاں', value: patti.otherDeductionsPkr ? fmtPdfMoney(patti.otherDeductionsPkr) : '-' },
  ];

  return (
    <VoucherShell
      voucherKind="MANDI SALE INVOICE / منڈی پٹی"
      voucherNumber={voucherNumber}
      voucherDate={patti.settledOn}
      entityName={entityName}
    >
      <LabelValueRow
        items={[
          { label: 'Arhti / آڑھتی', value: patti.arhtiName ?? '-' },
          { label: 'Mandi', value: patti.mandiLocation ?? '-' },
          { label: 'Dispatch No.', value: patti.dispatchNumber },
        ]}
      />
      <LabelValueRow
        items={[
          { label: 'Lot No.', value: patti.produceLotCode ?? '-' },
          { label: 'Vehicle', value: patti.vehicleNumber ?? '-' },
          { label: 'Driver', value: patti.driverName ?? '-' },
        ]}
      />
      <LabelValueRow
        items={[
          { label: 'Dispatched on', value: patti.dispatchedOn },
          { label: 'Settled on', value: patti.settledOn },
          { label: 'Net weight', value: `${fmtPdfQty(patti.netWeightKg)} kg` },
          { label: 'Bags', value: patti.bagsCount ?? '-' },
        ]}
      />

      <View style={[vStyles.table, { marginTop: 8 }]}>
        <View style={vStyles.trHead}>
          <Text style={[vStyles.th, { width: '40%' }]}>Item</Text>
          <Text style={[vStyles.th, { width: '30%', textAlign: 'right' }]}>تفصیل</Text>
          <Text style={[vStyles.th, { width: '30%', textAlign: 'right' }]}>Amount</Text>
        </View>
        <View style={[vStyles.tr, { backgroundColor: BRAND.paper2 }]}>
          <Text style={[vStyles.td, { width: '40%', fontWeight: 600 }]}>Gross sale</Text>
          <Text
            style={{
              fontFamily: 'NotoNastaliqUrdu',
              fontSize: 11,
              width: '30%',
              textAlign: 'right',
              color: BRAND.ink,
            }}
          >
            مجموعی فروخت
          </Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right', fontWeight: 600 }]}>
            {fmtPdfMoney(patti.grossPricePkr)}
          </Text>
        </View>
        {deductionRows.map((r, i) => (
          <View key={i} style={vStyles.tr} wrap={false}>
            <Text style={[vStyles.td, { width: '40%' }]}>Less: {r.label}</Text>
            <Text style={{ fontFamily: 'NotoNastaliqUrdu', fontSize: 11, width: '30%', textAlign: 'right', color: BRAND.ink }}>
              {r.labelUr}
            </Text>
            <Text style={[vStyles.td, { width: '30%', textAlign: 'right' }]}>{r.value}</Text>
          </View>
        ))}
        <View style={[vStyles.tr, { backgroundColor: BRAND.paper, borderTopWidth: 1, borderTopColor: BRAND.green }]}>
          <Text style={[vStyles.td, { width: '40%', fontWeight: 600, color: BRAND.green }]}>Net received</Text>
          <Text
            style={{
              fontFamily: 'NotoNastaliqUrdu',
              fontSize: 11,
              width: '30%',
              textAlign: 'right',
              color: BRAND.green,
            }}
          >
            خالص وصولی
          </Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right', fontWeight: 600, color: BRAND.green }]}>
            {fmtPdfMoney(patti.netReceivedPkr)}
          </Text>
        </View>
      </View>

      <AmountBox amountPkr={net} wordsEn={pkrToWords(net, 'en')} wordsUr={pkrToWords(net, 'ur')} />

      <SignatureRow slots={[{ label: 'Arhti / آڑھتی' }, { label: 'Director / ڈائریکٹر' }]} />
    </VoucherShell>
  );
}
