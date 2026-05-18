import * as React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { VoucherShell, AmountBox, SignatureRow, LabelValueRow, vStyles } from './voucher-shell';
import { pkrToWords } from './number-to-words';
import { fmtPdfMoney, BRAND } from '../reports/report-template';
import type { PurchaseInvoiceView } from './voucher-data';

export interface PurchaseInvoiceVoucherPdfProps {
  invoice: PurchaseInvoiceView;
  voucherNumber: string;
  entityName: string;
}

export function PurchaseInvoiceVoucherPdf({
  invoice,
  voucherNumber,
  entityName,
}: PurchaseInvoiceVoucherPdfProps): React.ReactElement {
  const total = Number(invoice.totalPkr);
  const balance = total - Number(invoice.paidPkr);
  return (
    <VoucherShell
      voucherKind="PURCHASE INVOICE RECEIPT"
      voucherNumber={voucherNumber}
      voucherDate={invoice.invoiceDate}
      entityName={entityName}
    >
      <LabelValueRow
        items={[
          { label: 'Vendor', value: invoice.vendorName },
          { label: 'Invoice No.', value: invoice.invoiceNumber },
          { label: 'PO No.', value: invoice.poNumber ?? '-' },
        ]}
      />
      <LabelValueRow
        items={[
          { label: 'Invoice date', value: invoice.invoiceDate },
          { label: 'Due date', value: invoice.dueDate ?? '-' },
          { label: 'NTN', value: invoice.vendorNtn ?? '-' },
        ]}
      />
      {invoice.vendorAddress ? (
        <View style={vStyles.block}>
          <Text style={vStyles.label}>Vendor address</Text>
          <Text style={vStyles.value}>{invoice.vendorAddress}</Text>
        </View>
      ) : null}

      <View style={[vStyles.table, { marginTop: 8 }]}>
        <View style={vStyles.trHead}>
          <Text style={[vStyles.th, { width: '70%' }]}>Item</Text>
          <Text style={[vStyles.th, { width: '30%', textAlign: 'right' }]}>Amount</Text>
        </View>
        <View style={vStyles.tr}>
          <Text style={[vStyles.td, { width: '70%' }]}>Subtotal</Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right' }]}>{fmtPdfMoney(invoice.subtotalPkr)}</Text>
        </View>
        <View style={vStyles.tr}>
          <Text style={[vStyles.td, { width: '70%' }]}>Tax</Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right' }]}>{fmtPdfMoney(invoice.taxPkr)}</Text>
        </View>
        <View style={[vStyles.tr, { backgroundColor: BRAND.paper, borderTopWidth: 1, borderTopColor: BRAND.green }]}>
          <Text style={[vStyles.td, { width: '70%', fontWeight: 600, color: BRAND.green }]}>Total</Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right', fontWeight: 600, color: BRAND.green }]}>
            {fmtPdfMoney(invoice.totalPkr)}
          </Text>
        </View>
        <View style={vStyles.tr}>
          <Text style={[vStyles.td, { width: '70%' }]}>Paid</Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right' }]}>{fmtPdfMoney(invoice.paidPkr)}</Text>
        </View>
        <View style={vStyles.tr}>
          <Text style={[vStyles.td, { width: '70%', fontWeight: 600 }]}>Balance</Text>
          <Text style={[vStyles.td, { width: '30%', textAlign: 'right', fontWeight: 600 }]}>{fmtPdfMoney(balance)}</Text>
        </View>
      </View>

      <AmountBox amountPkr={total} wordsEn={pkrToWords(total, 'en')} />

      <SignatureRow slots={[{ label: 'Prepared by' }, { label: 'Verified by' }, { label: 'Approved by' }]} />
    </VoucherShell>
  );
}
