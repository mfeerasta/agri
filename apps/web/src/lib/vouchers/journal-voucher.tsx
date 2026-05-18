import * as React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { VoucherShell, AmountBox, SignatureRow, LabelValueRow, vStyles } from './voucher-shell';
import { pkrToWords } from './number-to-words';
import { fmtPdfMoney } from '../reports/report-template';
import type { JournalVoucherView } from './voucher-data';

export interface JournalVoucherPdfProps {
  voucher: JournalVoucherView;
  voucherNumber: string;
  entityName: string;
}

export function JournalVoucherPdf({
  voucher,
  voucherNumber,
  entityName,
}: JournalVoucherPdfProps): React.ReactElement {
  const amount = Number(voucher.totalDebitPkr);
  return (
    <VoucherShell
      voucherKind="JOURNAL VOUCHER"
      voucherNumber={voucherNumber}
      voucherDate={voucher.postedOn}
      entityName={entityName}
    >
      <LabelValueRow
        items={[
          { label: 'Journal No.', value: voucher.journalNumber },
          { label: 'Posting date', value: voucher.postedOn },
        ]}
      />

      <View style={vStyles.block}>
        <Text style={vStyles.label}>Narration</Text>
        <Text style={vStyles.value}>{voucher.narration}</Text>
      </View>

      <AmountBox amountPkr={amount} wordsEn={pkrToWords(amount, 'en')} />

      <View style={[vStyles.table, { marginTop: 10 }]}>
        <View style={vStyles.trHead}>
          <Text style={[vStyles.th, { width: '12%' }]}>Code</Text>
          <Text style={[vStyles.th, { width: '36%' }]}>Account</Text>
          <Text style={[vStyles.th, { width: '14%', textAlign: 'right' }]}>Debit</Text>
          <Text style={[vStyles.th, { width: '14%', textAlign: 'right' }]}>Credit</Text>
          <Text style={[vStyles.th, { width: '24%' }]}>Narration</Text>
        </View>
        {voucher.lines.map((l, i) => (
          <View key={i} style={vStyles.tr} wrap={false}>
            <Text style={[vStyles.tdMono, { width: '12%' }]}>{l.accountCode}</Text>
            <Text style={[vStyles.td, { width: '36%' }]}>{l.accountName}</Text>
            <Text style={[vStyles.td, { width: '14%', textAlign: 'right' }]}>
              {Number(l.debitPkr) > 0 ? fmtPdfMoney(l.debitPkr) : ''}
            </Text>
            <Text style={[vStyles.td, { width: '14%', textAlign: 'right' }]}>
              {Number(l.creditPkr) > 0 ? fmtPdfMoney(l.creditPkr) : ''}
            </Text>
            <Text style={[vStyles.td, { width: '24%' }]}>{l.narration ?? ''}</Text>
          </View>
        ))}
      </View>

      <SignatureRow
        slots={[{ label: 'Prepared by' }, { label: 'Checked by' }, { label: 'Approved by' }]}
      />
    </VoucherShell>
  );
}
