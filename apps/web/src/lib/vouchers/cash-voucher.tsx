import * as React from 'react';
import { Text, View } from '@react-pdf/renderer';
import {
  VoucherShell,
  AmountBox,
  SignatureRow,
  LabelValueRow,
  vStyles,
} from './voucher-shell';
import { pkrToWords } from './number-to-words';
import { fmtPdfMoney } from '../reports/report-template';
import type { JournalVoucherView } from './voucher-data';

export type CashVoucherKind = 'cash-receipt' | 'cash-payment' | 'bank-receipt' | 'bank-payment';

const TITLE_FOR_KIND: Record<CashVoucherKind, string> = {
  'cash-receipt': 'CASH RECEIPT VOUCHER',
  'cash-payment': 'CASH PAYMENT VOUCHER',
  'bank-receipt': 'BANK RECEIPT VOUCHER',
  'bank-payment': 'BANK PAYMENT VOUCHER',
};

const HIGH_VALUE_THRESHOLD_PKR = 50_000;

function signatureSlots(kind: CashVoucherKind, amountPkr: number) {
  if (kind === 'cash-receipt' || kind === 'bank-receipt') {
    return [{ label: 'Received by' }, { label: 'Cashier' }, { label: 'Manager' }];
  }
  const base = [{ label: 'Payee' }, { label: 'Cashier' }, { label: 'Manager' }];
  if (amountPkr > HIGH_VALUE_THRESHOLD_PKR) base.push({ label: 'Director' });
  return base;
}

export interface CashVoucherPdfProps {
  voucher: JournalVoucherView;
  voucherNumber: string;
  kind: CashVoucherKind;
  entityName: string;
  partyName: string;
}

export function CashVoucherPdf({
  voucher,
  voucherNumber,
  kind,
  entityName,
  partyName,
}: CashVoucherPdfProps): React.ReactElement {
  const isReceipt = kind === 'cash-receipt' || kind === 'bank-receipt';
  const amount = Number(voucher.totalDebitPkr);

  // Identify counterparty line: for cash receipt = CR side (non-cash account); for payment = DR side.
  const counterpartyLine = voucher.lines.find((l) => {
    const dr = Number(l.debitPkr);
    const cr = Number(l.creditPkr);
    return isReceipt ? cr > 0 : dr > 0;
  });

  return (
    <VoucherShell
      voucherKind={TITLE_FOR_KIND[kind]}
      voucherNumber={voucherNumber}
      voucherDate={voucher.postedOn}
      entityName={entityName}
    >
      <LabelValueRow
        items={[
          { label: isReceipt ? 'Received from' : 'Paid to', value: partyName },
          { label: 'Posting date', value: voucher.postedOn },
          { label: 'Journal No.', value: voucher.journalNumber },
        ]}
      />

      <View style={vStyles.block}>
        <Text style={vStyles.label}>Narration</Text>
        <Text style={vStyles.value}>{voucher.narration}</Text>
      </View>

      {counterpartyLine ? (
        <View style={vStyles.block}>
          <Text style={vStyles.label}>{isReceipt ? 'Credited account' : 'Debited account'}</Text>
          <Text style={vStyles.value}>
            {counterpartyLine.accountCode} - {counterpartyLine.accountName}
          </Text>
        </View>
      ) : null}

      <AmountBox amountPkr={amount} wordsEn={pkrToWords(amount, 'en')} wordsUr={pkrToWords(amount, 'ur')} />

      <View style={[vStyles.table, { marginTop: 10 }]}>
        <View style={vStyles.trHead}>
          <Text style={[vStyles.th, { width: '14%' }]}>Code</Text>
          <Text style={[vStyles.th, { width: '46%' }]}>Account</Text>
          <Text style={[vStyles.th, { width: '20%', textAlign: 'right' }]}>Debit</Text>
          <Text style={[vStyles.th, { width: '20%', textAlign: 'right' }]}>Credit</Text>
        </View>
        {voucher.lines.map((l, i) => (
          <View key={i} style={vStyles.tr} wrap={false}>
            <Text style={[vStyles.tdMono, { width: '14%' }]}>{l.accountCode}</Text>
            <Text style={[vStyles.td, { width: '46%' }]}>{l.accountName}</Text>
            <Text style={[vStyles.td, { width: '20%', textAlign: 'right' }]}>
              {Number(l.debitPkr) > 0 ? fmtPdfMoney(l.debitPkr) : ''}
            </Text>
            <Text style={[vStyles.td, { width: '20%', textAlign: 'right' }]}>
              {Number(l.creditPkr) > 0 ? fmtPdfMoney(l.creditPkr) : ''}
            </Text>
          </View>
        ))}
      </View>

      <SignatureRow slots={signatureSlots(kind, amount)} />
    </VoucherShell>
  );
}
