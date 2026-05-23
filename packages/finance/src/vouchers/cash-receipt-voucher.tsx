import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { BRAND, PAGE_SIZE, voucherStyles as s, type WatermarkVariant } from './voucher-styles.js';
import { amountInWordsEn, amountInWordsUr } from './amount-in-words.js';

export interface CashReceiptVoucherProps {
  voucherNumber: string;
  entityName: string;
  entityNameUr?: string;
  entityAddress?: string;
  postedOn: string;
  receivedFromName: string;
  receivedFromNameUr?: string;
  accountCreditedCode: string;
  accountCreditedName: string;
  accountCreditedNameUr?: string;
  amountRupees: number;
  narration: string;
  preparedBy?: string;
  watermark?: WatermarkVariant;
}

function formatRupees(rupees: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rupees)}`;
}

export function CashReceiptVoucher(props: CashReceiptVoucherProps): React.JSX.Element {
  const {
    voucherNumber,
    entityName,
    entityNameUr,
    entityAddress,
    postedOn,
    receivedFromName,
    receivedFromNameUr,
    accountCreditedCode,
    accountCreditedName,
    accountCreditedNameUr,
    amountRupees,
    narration,
    preparedBy,
    watermark = null,
  } = props;

  return (
    <Document title={`Cash Receipt Voucher ${voucherNumber}`}>
      <Page size={PAGE_SIZE} style={s.page}>
        {watermark ? <Text style={s.watermark} fixed>{watermark}</Text> : null}

        <View style={s.header}>
          <View>
            <Text style={s.brand}>Zameen · Rupafab Agri</Text>
            <Text style={s.org}>{entityName}</Text>
            {entityNameUr ? <Text style={s.orgSub}>{entityNameUr}</Text> : null}
            {entityAddress ? <Text style={s.orgSub}>{entityAddress}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.titleEn}>CASH RECEIPT VOUCHER</Text>
            <Text style={s.titleUr}>کیش وصولی واؤچر</Text>
          </View>
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Voucher No · نمبر</Text>
            <Text style={s.metaValue}>{voucherNumber}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Date · تاریخ</Text>
            <Text style={s.metaValue}>{postedOn}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Type · قسم</Text>
            <Text style={s.metaValue}>Cash Receipt</Text>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.label}>Received From · وصول کنندہ سے</Text>
            <Text style={s.value}>{receivedFromName}{receivedFromNameUr ? `  ·  ${receivedFromNameUr}` : ''}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Account Credited · کھاتہ</Text>
            <Text style={s.value}>
              {accountCreditedCode} · {accountCreditedName}{accountCreditedNameUr ? ` · ${accountCreditedNameUr}` : ''}
            </Text>
          </View>
        </View>

        <View style={s.amountBox}>
          <Text style={s.metaLabel}>Amount · رقم</Text>
          <Text style={s.amountFigures}>{formatRupees(amountRupees)}</Text>
          <Text style={s.amountWords}>In words: {amountInWordsEn(amountRupees)}</Text>
          <Text style={s.amountWordsUr}>الفاظ میں: {amountInWordsUr(amountRupees)}</Text>
        </View>

        <View style={s.narrationBox}>
          <Text style={s.narrationLabel}>Narration · تفصیل</Text>
          <Text style={s.narrationText}>{narration}</Text>
        </View>

        <View style={s.signaturesRow}>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Cashier · خزانچی</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Received By · وصول کنندہ</Text>
          </View>
          <View style={s.sigCell}>
            <View style={s.sigLine}><Text> </Text></View>
            <Text style={s.sigLabel}>Approver · منظوری</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>agri.feerasta.ai · Cash Receipt Voucher · کیش وصولی</Text>
          <Text>{preparedBy ? `Prepared by ${preparedBy}` : ''}</Text>
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
