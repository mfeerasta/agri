import * as React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { VoucherShell, SignatureRow, vStyles } from './voucher-shell';
import { pkrToWords } from './number-to-words';
import { fmtPdfMoney, fmtPdfDate, BRAND } from '../reports/report-template';
import type { PayslipView } from './voucher-data';

export interface PayslipVoucherPdfProps {
  payslip: PayslipView;
  voucherNumber: string;
  entityName: string;
}

interface BilingualRow {
  labelEn: string;
  labelUr: string;
  value: string;
  emphasis?: boolean;
}

export function PayslipVoucherPdf({
  payslip,
  voucherNumber,
  entityName,
}: PayslipVoucherPdfProps): React.ReactElement {
  const net = Number(payslip.netPkr);

  const rows: BilingualRow[] = [
    {
      labelEn: 'Days worked',
      labelUr: 'کام کے دن',
      value: payslip.daysWorked,
    },
    {
      labelEn: 'Base salary',
      labelUr: 'بنیادی تنخواہ',
      value: fmtPdfMoney(payslip.baseSalaryPkr),
    },
    {
      labelEn: 'Piece-rate earnings',
      labelUr: 'پیس ریٹ آمدنی',
      value: fmtPdfMoney(payslip.pieceRateEarningsPkr),
    },
    {
      labelEn: 'Deductions',
      labelUr: 'کٹوتیاں',
      value: `- ${fmtPdfMoney(payslip.deductionsPkr)}`,
    },
    {
      labelEn: 'Advances recovered',
      labelUr: 'پیشگی رقم کی وصولی',
      value: `- ${fmtPdfMoney(payslip.advancesPkr)}`,
    },
    {
      labelEn: 'Net pay',
      labelUr: 'خالص ادائیگی',
      value: fmtPdfMoney(payslip.netPkr),
      emphasis: true,
    },
  ];

  return (
    <VoucherShell
      voucherKind="WORKER PAYSLIP / تنخواہ کی پرچی"
      voucherNumber={voucherNumber}
      voucherDate={payslip.periodEnd}
      entityName={entityName}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ width: '60%' }}>
          <Text style={vStyles.label}>Worker / مزدور</Text>
          <Text style={vStyles.value}>{payslip.workerName}</Text>
          {payslip.workerNameUr ? (
            <Text
              style={{
                fontFamily: 'NotoNastaliqUrdu',
                fontSize: 12,
                color: BRAND.ink,
                marginTop: 2,
                textAlign: 'left',
                direction: 'rtl',
              }}
            >
              {payslip.workerNameUr}
            </Text>
          ) : null}
          <Text style={[vStyles.value, { fontSize: 9, color: BRAND.inkMuted, marginTop: 2 }]}>
            Code: {payslip.workerCode}
            {payslip.cnicLast4 ? `  ·  CNIC xxxx-xxxxxxx-${payslip.cnicLast4}` : ''}
          </Text>
        </View>
        <View style={{ width: '36%' }}>
          <Text style={vStyles.label}>Pay period / ادائیگی کی مدت</Text>
          <Text style={vStyles.value}>
            {fmtPdfDate(payslip.periodStart)} - {fmtPdfDate(payslip.periodEnd)}
          </Text>
        </View>
      </View>

      <View style={vStyles.table}>
        <View style={vStyles.trHead}>
          <Text style={[vStyles.th, { width: '40%' }]}>Item</Text>
          <Text style={[vStyles.th, { width: '36%', textAlign: 'right' }]}>تفصیل</Text>
          <Text style={[vStyles.th, { width: '24%', textAlign: 'right' }]}>Amount</Text>
        </View>
        {rows.map((r, i) => (
          <View
            key={i}
            style={[
              vStyles.tr,
              r.emphasis ? { backgroundColor: BRAND.paper, borderTopWidth: 1, borderTopColor: BRAND.green } : {},
            ]}
            wrap={false}
          >
            <Text
              style={[
                vStyles.td,
                { width: '40%' },
                r.emphasis ? { fontWeight: 600, color: BRAND.green } : {},
              ]}
            >
              {r.labelEn}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoNastaliqUrdu',
                fontSize: 11,
                width: '36%',
                textAlign: 'right',
                color: r.emphasis ? BRAND.green : BRAND.ink,
              }}
            >
              {r.labelUr}
            </Text>
            <Text
              style={[
                vStyles.td,
                { width: '24%', textAlign: 'right' },
                r.emphasis ? { fontWeight: 600, color: BRAND.green } : {},
              ]}
            >
              {r.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 14, padding: 10, backgroundColor: BRAND.paper, borderWidth: 0.5, borderColor: BRAND.rule }}>
        <Text style={vStyles.label}>Net pay in words / الفاظ میں خالص ادائیگی</Text>
        <Text style={[vStyles.value, { marginTop: 3 }]}>{pkrToWords(net, 'en')}</Text>
        <Text
          style={{
            fontFamily: 'NotoNastaliqUrdu',
            fontSize: 11,
            marginTop: 6,
            textAlign: 'right',
            direction: 'rtl',
            color: BRAND.ink,
            lineHeight: 1.6,
          }}
        >
          {pkrToWords(net, 'ur')}
        </Text>
      </View>

      <SignatureRow slots={[{ label: 'Worker / مزدور' }, { label: 'Cashier / خزانچی' }, { label: 'Manager / مینیجر' }]} />
    </VoucherShell>
  );
}
