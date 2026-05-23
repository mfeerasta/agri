import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { BRAND, PAGE_SIZE, voucherStyles as s, type WatermarkVariant } from './voucher-styles.js';
import { amountInWordsEn, amountInWordsUr } from './amount-in-words.js';

export interface PayslipAttendance {
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  daysHoliday?: number;
}

export interface WorkerPayslipProps {
  voucherNumber: string;
  entityName: string;
  entityNameUr?: string;
  periodStart: string;
  periodEnd: string;
  workerCode: string;
  workerName: string;
  workerNameUr?: string;
  cnicLast4?: string;
  role: string;
  attendance: PayslipAttendance;
  baseSalaryRupees: number;
  pieceRateRupees: number;
  grossRupees: number;
  deductionsRupees: number;
  advancesRupees: number;
  netRupees: number;
  notes?: string;
  watermark?: WatermarkVariant;
}

function fmt(n: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function WorkerPayslip(props: WorkerPayslipProps): React.JSX.Element {
  const {
    voucherNumber, entityName, entityNameUr, periodStart, periodEnd,
    workerCode, workerName, workerNameUr, cnicLast4, role, attendance,
    baseSalaryRupees, pieceRateRupees, grossRupees, deductionsRupees, advancesRupees, netRupees,
    notes, watermark = null,
  } = props;

  return (
    <Document title={`Payslip ${voucherNumber} · ${workerName}`}>
      <Page size={PAGE_SIZE} style={s.page}>
        {watermark ? <Text style={s.watermark} fixed>{watermark}</Text> : null}

        <View style={s.header}>
          <View>
            <Text style={s.brand}>Zameen · Rupafab Agri</Text>
            <Text style={s.org}>{entityName}</Text>
            {entityNameUr ? <Text style={s.orgSub}>{entityNameUr}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titleUr}>تنخواہ کی پرچی</Text>
            <Text style={s.titleEn}>WORKER PAYSLIP</Text>
          </View>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Payslip No · پرچی نمبر</Text>
            <Text style={s.metaValue}>{voucherNumber}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Period · مدت</Text>
            <Text style={s.metaValue}>{periodStart} → {periodEnd}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Worker Code · کوڈ</Text>
            <Text style={s.metaValue}>{workerCode}</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.label}>Name · نام</Text>
            <Text style={s.value}>{workerName}{workerNameUr ? `  ·  ${workerNameUr}` : ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CNIC (last 4) · شناختی کارڈ</Text>
            <Text style={s.value}>{cnicLast4 ? `xxxxx-xxxxxxx-${cnicLast4}` : '-'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Role · عہدہ</Text>
            <Text style={s.value}>{role}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '34%' }]}>Attendance · حاضری</Text>
            <Text style={[s.th, { flexBasis: '22%', textAlign: 'right' }]}>Present · حاضر</Text>
            <Text style={[s.th, { flexBasis: '22%', textAlign: 'right' }]}>Absent · غیر حاضر</Text>
            <Text style={[s.th, { flexBasis: '22%', textAlign: 'right' }]}>Leave · چھٹی</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '34%' }]}>Days · دن</Text>
            <Text style={[s.tdRight, { flexBasis: '22%' }]}>{attendance.daysPresent.toFixed(1)}</Text>
            <Text style={[s.tdRight, { flexBasis: '22%' }]}>{attendance.daysAbsent.toFixed(1)}</Text>
            <Text style={[s.tdRight, { flexBasis: '22%' }]}>{attendance.daysLeave.toFixed(1)}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '70%' }]}>Earnings · کمائی</Text>
            <Text style={[s.th, { flexBasis: '30%', textAlign: 'right' }]}>PKR</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '70%' }]}>Base salary · بنیادی تنخواہ</Text>
            <Text style={[s.tdRight, { flexBasis: '30%' }]}>{fmt(baseSalaryRupees)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '70%' }]}>Piece rate · ٹھیکہ اجرت</Text>
            <Text style={[s.tdRight, { flexBasis: '30%' }]}>{fmt(pieceRateRupees)}</Text>
          </View>
          <View style={s.tableTotalRow}>
            <Text style={[s.tdBold, { flexBasis: '70%' }]}>Gross · کل کمائی</Text>
            <Text style={[s.tdBold, { flexBasis: '30%', textAlign: 'right' }]}>{fmt(grossRupees)}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flexBasis: '70%' }]}>Deductions · کٹوتیاں</Text>
            <Text style={[s.th, { flexBasis: '30%', textAlign: 'right' }]}>PKR</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '70%' }]}>Deductions · کٹوتیاں</Text>
            <Text style={[s.tdRight, { flexBasis: '30%' }]}>{fmt(deductionsRupees)}</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.td, { flexBasis: '70%' }]}>Advances · پیشگی</Text>
            <Text style={[s.tdRight, { flexBasis: '30%' }]}>{fmt(advancesRupees)}</Text>
          </View>
          <View style={s.tableTotalRow}>
            <Text style={[s.tdBold, { flexBasis: '70%' }]}>Net pay · خالص ادائیگی</Text>
            <Text style={[s.tdBold, { flexBasis: '30%', textAlign: 'right' }]}>{fmt(netRupees)}</Text>
          </View>
        </View>

        <View style={s.amountBox}>
          <Text style={s.metaLabel}>Net Pay In Words · رقم الفاظ میں</Text>
          <Text style={s.amountWords}>{amountInWordsEn(netRupees)}</Text>
          <Text style={s.amountWordsUr}>{amountInWordsUr(netRupees)}</Text>
        </View>

        {notes ? (
          <View style={s.narrationBox}>
            <Text style={s.narrationLabel}>Notes · تبصرہ</Text>
            <Text style={s.narrationText}>{notes}</Text>
          </View>
        ) : null}

        <View style={s.signaturesRow}>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Worker · مزدور</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Supervisor · سپروائزر</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Cashier · خزانچی</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Worker Payslip · تنخواہ کی پرچی</Text>
          <Text>{periodStart} → {periodEnd}</Text>
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
