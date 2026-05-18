import * as React from 'react';
import { Text, View, Image } from '@react-pdf/renderer';
import { VoucherShell, SignatureRow, LabelValueRow, vStyles } from './voucher-shell';
import { BRAND } from '../reports/report-template';
import type { GrnView } from './voucher-data';

export interface GrnVoucherPdfProps {
  grn: GrnView;
  voucherNumber: string;
  entityName: string;
}

export function GrnVoucherPdf({ grn, voucherNumber, entityName }: GrnVoucherPdfProps): React.ReactElement {
  return (
    <VoucherShell
      voucherKind="GOODS RECEIVED NOTE"
      voucherNumber={voucherNumber}
      voucherDate={grn.receivedOn}
      entityName={entityName}
    >
      <LabelValueRow
        items={[
          { label: 'GRN No.', value: grn.grnNumber },
          { label: 'Vendor', value: grn.vendorName },
          { label: 'PO No.', value: grn.poNumber },
        ]}
      />
      <LabelValueRow
        items={[
          { label: 'Received on', value: grn.receivedOn },
          { label: 'QC status', value: grn.qcPassed ? 'Passed' : 'Failed' },
          { label: 'Vendor address', value: grn.vendorAddress ?? '-' },
        ]}
      />

      <View style={[vStyles.table, { marginTop: 4 }]}>
        <View style={vStyles.trHead}>
          <Text style={[vStyles.th, { width: '8%' }]}>#</Text>
          <Text style={[vStyles.th, { width: '40%' }]}>Item</Text>
          <Text style={[vStyles.th, { width: '14%', textAlign: 'right' }]}>Qty</Text>
          <Text style={[vStyles.th, { width: '12%' }]}>Unit</Text>
          <Text style={[vStyles.th, { width: '14%' }]}>Condition</Text>
          <Text style={[vStyles.th, { width: '12%' }]}>QC</Text>
        </View>
        {grn.lines.length === 0 ? (
          <View style={vStyles.tr}>
            <Text style={[vStyles.td, { width: '100%', color: BRAND.inkMuted, fontStyle: 'italic' }]}>
              No line items.
            </Text>
          </View>
        ) : (
          grn.lines.map((l, i) => (
            <View key={i} style={vStyles.tr} wrap={false}>
              <Text style={[vStyles.tdMono, { width: '8%' }]}>{i + 1}</Text>
              <Text style={[vStyles.td, { width: '40%' }]}>{l.itemName}</Text>
              <Text style={[vStyles.td, { width: '14%', textAlign: 'right' }]}>{String(l.quantity)}</Text>
              <Text style={[vStyles.td, { width: '12%' }]}>{l.unit}</Text>
              <Text style={[vStyles.td, { width: '14%' }]}>{l.condition ?? '-'}</Text>
              <Text style={[vStyles.td, { width: '12%' }]}>{l.qcStatus ?? (grn.qcPassed ? 'OK' : 'Fail')}</Text>
            </View>
          ))
        )}
      </View>

      {grn.qcNotes ? (
        <View style={[vStyles.block, { marginTop: 10 }]}>
          <Text style={vStyles.label}>QC notes</Text>
          <Text style={vStyles.value}>{grn.qcNotes}</Text>
        </View>
      ) : null}

      {grn.photoUrls.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Text style={vStyles.label}>Photo evidence</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {grn.photoUrls.slice(0, 6).map((url, i) => (
              <Image
                key={i}
                src={url}
                style={{
                  width: 70,
                  height: 70,
                  borderWidth: 0.5,
                  borderColor: BRAND.rule,
                  objectFit: 'cover',
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <SignatureRow
        slots={[{ label: 'Received by' }, { label: 'Store keeper' }, { label: 'Manager' }]}
      />
    </VoucherShell>
  );
}
