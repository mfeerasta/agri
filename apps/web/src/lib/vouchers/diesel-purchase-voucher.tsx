import * as React from 'react';
import { Text, View, Image } from '@react-pdf/renderer';
import { VoucherShell, AmountBox, SignatureRow, LabelValueRow, vStyles } from './voucher-shell';
import { pkrToWords } from './number-to-words';
import { fmtPdfMoney, fmtPdfQty, fmtPdfDateTime, BRAND } from '../reports/report-template';
import type { DieselPurchaseView } from './voucher-data';

export interface DieselPurchaseVoucherPdfProps {
  purchase: DieselPurchaseView;
  voucherNumber: string;
  entityName: string;
}

export function DieselPurchaseVoucherPdf({
  purchase,
  voucherNumber,
  entityName,
}: DieselPurchaseVoucherPdfProps): React.ReactElement {
  const total = Number(purchase.totalPkr);
  return (
    <VoucherShell
      voucherKind="DIESEL PURCHASE VOUCHER"
      voucherNumber={voucherNumber}
      voucherDate={purchase.purchasedAt}
      entityName={entityName}
    >
      <LabelValueRow
        items={[
          { label: 'Pump / vendor', value: purchase.vendorName },
          { label: 'Location', value: purchase.vendorLocation ?? '-' },
          { label: 'Purchased at', value: fmtPdfDateTime(purchase.purchasedAt) },
        ]}
      />
      <LabelValueRow
        items={[
          { label: 'Quantity', value: `${fmtPdfQty(purchase.quantityLiters)} L` },
          { label: 'Rate / litre', value: fmtPdfMoney(purchase.rateLiterPkr) },
          { label: 'Payment method', value: purchase.paymentMethod },
          { label: 'Approval Ref.', value: purchase.approvalRequestId ?? '-' },
        ]}
      />

      <AmountBox amountPkr={total} wordsEn={pkrToWords(total, 'en')} wordsUr={pkrToWords(total, 'ur')} />

      {purchase.receiptPhotoUrls.length === 0 ? (
        <Text style={{ fontSize: 9, color: BRAND.danger, fontStyle: 'italic', marginTop: 6 }}>
          Missing receipt photo. Diesel purchases require photo evidence.
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Text style={vStyles.label}>Pump receipt photo</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {purchase.receiptPhotoUrls.slice(0, 4).map((url, i) => (
              <Image
                key={i}
                src={url}
                style={{
                  width: 120,
                  height: 120,
                  borderWidth: 0.5,
                  borderColor: BRAND.rule,
                  objectFit: 'cover',
                }}
              />
            ))}
          </View>
        </View>
      )}

      {purchase.notes ? (
        <View style={[vStyles.block, { marginTop: 10 }]}>
          <Text style={vStyles.label}>Notes</Text>
          <Text style={vStyles.value}>{purchase.notes}</Text>
        </View>
      ) : null}

      <SignatureRow
        slots={[{ label: 'Driver / Operator' }, { label: 'Cashier' }, { label: 'Manager' }, { label: 'Director' }]}
      />
    </VoucherShell>
  );
}
