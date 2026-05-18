import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { BRAND, fmtPdfDate } from '../reports/report-template';

let fontsRegistered = false;
function registerFontsOnce(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    Font.register({
      family: 'Inter',
      fonts: [
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.ttf', fontWeight: 400 },
        { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.ttf', fontWeight: 600 },
      ],
    });
    // Noto Nastaliq Urdu for Urdu rendering.
    Font.register({
      family: 'NotoNastaliqUrdu',
      fonts: [
        {
          src: 'https://fonts.gstatic.com/s/notonastaliqurdu/v23/LhWNMUPbN-oZdNFcBy1-DJYsEoTq5puXcLfnAA.ttf',
          fontWeight: 400,
        },
      ],
    });
  } catch {
    // Fallback to Helvetica.
  }
}

export const vStyles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontFamily: 'Inter',
    fontSize: 10,
    color: BRAND.ink,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.green,
    paddingBottom: 8,
    marginBottom: 16,
  },
  brand: { fontSize: 16, fontWeight: 600, color: BRAND.green, letterSpacing: 1 },
  brandSub: { fontSize: 8, color: BRAND.ochre, letterSpacing: 2, marginTop: 2 },
  voucherKind: {
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.ink,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  metaCol: { flexDirection: 'column', alignItems: 'flex-end' },
  metaLine: { fontSize: 9, color: BRAND.inkMuted },
  metaMono: { fontSize: 10, fontWeight: 600, color: BRAND.green },
  block: { marginBottom: 10 },
  label: {
    fontSize: 7.5,
    color: BRAND.ochre,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: { fontSize: 10, color: BRAND.ink },
  amountBoxRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BRAND.rule,
    marginTop: 10,
    marginBottom: 12,
  },
  amountFigures: {
    width: '36%',
    backgroundColor: BRAND.paper,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: BRAND.rule,
  },
  amountWordsBox: { width: '64%', padding: 10 },
  amountBig: { fontSize: 18, fontWeight: 600, color: BRAND.green },
  amountSub: { fontSize: 8, color: BRAND.inkMuted, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },
  wordsEn: { fontSize: 9.5, color: BRAND.ink, marginTop: 4, lineHeight: 1.35 },
  wordsUr: {
    fontFamily: 'NotoNastaliqUrdu',
    fontSize: 11,
    color: BRAND.ink,
    marginTop: 6,
    direction: 'rtl',
    textAlign: 'right',
    lineHeight: 1.6,
  },
  sigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 36,
  },
  sigBox: { width: '30%' },
  sigLine: { borderTopWidth: 0.5, borderTopColor: BRAND.ink, marginTop: 28 },
  sigLabel: {
    fontSize: 8,
    color: BRAND.inkMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 3,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: BRAND.inkMuted,
    borderTopWidth: 0.5,
    borderTopColor: BRAND.rule,
    paddingTop: 6,
  },
  table: { marginTop: 6, borderTopWidth: 0.5, borderTopColor: BRAND.rule },
  trHead: {
    flexDirection: 'row',
    backgroundColor: BRAND.paper2,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.rule,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.rule,
  },
  th: { fontSize: 8, fontWeight: 600, color: BRAND.green, letterSpacing: 0.5, textTransform: 'uppercase' },
  td: { fontSize: 9.5, color: BRAND.ink },
  tdMono: { fontSize: 9, fontFamily: 'Inter', color: BRAND.ink },
});

export interface VoucherHeaderProps {
  voucherKind: string;
  voucherNumber: string;
  voucherDate: Date | string;
  entityName: string;
}

export function VoucherHeader({ voucherKind, voucherNumber, voucherDate, entityName }: VoucherHeaderProps) {
  return (
    <View style={vStyles.headerRow} fixed>
      <View>
        <Text style={vStyles.brand}>RUPAFAB AGRI</Text>
        <Text style={vStyles.brandSub}>ZAMEEN OPERATIONS</Text>
        <Text style={vStyles.voucherKind}>{voucherKind}</Text>
      </View>
      <View style={vStyles.metaCol}>
        <Text style={vStyles.metaLine}>{entityName}</Text>
        <Text style={vStyles.metaMono}>{voucherNumber}</Text>
        <Text style={vStyles.metaLine}>Date: {fmtPdfDate(voucherDate)}</Text>
      </View>
    </View>
  );
}

export function VoucherFooter({ entityName }: { entityName: string }) {
  return (
    <View style={vStyles.footer} fixed>
      <Text>Generated by Zameen, {entityName}</Text>
      <Text
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

export interface VoucherShellProps {
  voucherKind: string;
  voucherNumber: string;
  voucherDate: Date | string;
  entityName: string;
  documentTitle?: string;
  children: React.ReactNode;
}

export function VoucherShell({
  voucherKind,
  voucherNumber,
  voucherDate,
  entityName,
  documentTitle,
  children,
}: VoucherShellProps) {
  registerFontsOnce();
  return (
    <Document
      title={documentTitle ?? `${voucherKind} ${voucherNumber}`}
      author="Zameen"
      creator="Zameen"
      producer="Zameen"
      subject={entityName}
    >
      <Page size="A4" style={vStyles.page}>
        <VoucherHeader
          voucherKind={voucherKind}
          voucherNumber={voucherNumber}
          voucherDate={voucherDate}
          entityName={entityName}
        />
        <View>{children}</View>
        <VoucherFooter entityName={entityName} />
      </Page>
    </Document>
  );
}

export interface SignatureSpec {
  label: string;
}

export function SignatureRow({ slots }: { slots: SignatureSpec[] }) {
  return (
    <View style={vStyles.sigRow}>
      {slots.map((s, i) => (
        <View key={i} style={vStyles.sigBox}>
          <View style={vStyles.sigLine} />
          <Text style={vStyles.sigLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

export interface AmountBoxProps {
  amountPkr: number | string;
  wordsEn: string;
  wordsUr?: string;
}

export function AmountBox({ amountPkr, wordsEn, wordsUr }: AmountBoxProps): React.ReactElement {
  const num = typeof amountPkr === 'string' ? Number(amountPkr) : amountPkr;
  const formatted = Number.isFinite(num)
    ? `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`
    : '';
  return (
    <View style={vStyles.amountBoxRow} wrap={false}>
      <View style={vStyles.amountFigures}>
        <Text style={vStyles.amountBig}>{formatted}</Text>
        <Text style={vStyles.amountSub}>In figures</Text>
      </View>
      <View style={vStyles.amountWordsBox}>
        <Text style={vStyles.amountSub}>In words</Text>
        <Text style={vStyles.wordsEn}>{wordsEn}</Text>
        {wordsUr ? <Text style={vStyles.wordsUr}>{wordsUr}</Text> : null}
      </View>
    </View>
  );
}

export interface LabelValueProps {
  label: string;
  value: string | null | undefined;
  width?: string;
}

export function LabelValue({ label, value, width }: LabelValueProps): React.ReactElement {
  return (
    <View style={[vStyles.block, width ? { width } : {}]}>
      <Text style={vStyles.label}>{label}</Text>
      <Text style={vStyles.value}>{value ?? '-'}</Text>
    </View>
  );
}

export function LabelValueRow({ items }: { items: LabelValueProps[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 18, marginBottom: 10 }}>
      {items.map((it, i) => (
        <LabelValue key={i} {...it} />
      ))}
    </View>
  );
}
