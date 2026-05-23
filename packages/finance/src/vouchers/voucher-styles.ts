/**
 * Shared print-ready styles for all Zameen vouchers.
 * A4, narrow margins, deep-green/ochre brand. Bilingual labels.
 */

import { StyleSheet } from '@react-pdf/renderer';

export const BRAND = {
  deepGreen: '#1B4332',
  ochre: '#D4A574',
  ink: '#1a1a1a',
  muted: '#555',
  border: '#999',
  softBg: '#F7F3EC',
};

export const PAGE_SIZE: 'A4' = 'A4';

export const voucherStyles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingLeft: 32,
    paddingRight: 32,
    fontSize: 10,
    color: BRAND.ink,
    fontFamily: 'Helvetica',
    lineHeight: 1.35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.ochre,
    paddingBottom: 6,
    marginBottom: 10,
  },
  brand: { color: BRAND.ochre, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  org: { color: BRAND.deepGreen, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  orgSub: { color: BRAND.muted, fontSize: 9 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 },
  titleEn: { fontSize: 16, color: BRAND.deepGreen, fontFamily: 'Helvetica-Bold' },
  titleUr: { fontSize: 14, color: BRAND.deepGreen, fontFamily: 'Helvetica-Bold' },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0.75,
    borderColor: BRAND.border,
    padding: 6,
    marginBottom: 10,
    backgroundColor: BRAND.softBg,
  },
  metaCell: { flexDirection: 'column', flexBasis: '32%' },
  metaLabel: { fontSize: 8, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { fontSize: 11, color: BRAND.ink, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 9, color: BRAND.muted },
  value: { fontSize: 10, color: BRAND.ink },
  table: { borderWidth: 0.75, borderColor: BRAND.border, marginBottom: 8 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: BRAND.deepGreen,
    color: '#fff',
    padding: 4,
  },
  tableRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: BRAND.border, padding: 4 },
  tableTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BRAND.deepGreen,
    padding: 4,
    backgroundColor: BRAND.softBg,
  },
  th: { color: '#fff', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 9, color: BRAND.ink },
  tdRight: { fontSize: 9, color: BRAND.ink, textAlign: 'right' },
  tdBold: { fontSize: 9, color: BRAND.ink, fontFamily: 'Helvetica-Bold' },
  amountBox: {
    borderWidth: 0.75,
    borderColor: BRAND.border,
    padding: 8,
    marginBottom: 8,
    backgroundColor: BRAND.softBg,
  },
  amountFigures: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND.deepGreen },
  amountWords: { fontSize: 9, color: BRAND.ink, marginTop: 2 },
  amountWordsUr: { fontSize: 10, color: BRAND.ink, marginTop: 2, textAlign: 'right' },
  narrationBox: { borderWidth: 0.5, borderColor: BRAND.border, padding: 6, marginBottom: 14, minHeight: 36 },
  narrationLabel: { fontSize: 8, color: BRAND.muted, marginBottom: 2 },
  narrationText: { fontSize: 10, color: BRAND.ink },
  signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  sigCell: { flexDirection: 'column', alignItems: 'center', flexBasis: '30%' },
  sigLine: { borderTopWidth: 0.75, borderTopColor: BRAND.ink, width: '100%', paddingTop: 4 },
  sigLabel: { fontSize: 8, color: BRAND.muted, marginTop: 2, textAlign: 'center' },
  watermark: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 96,
    color: BRAND.ochre,
    opacity: 0.12,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 7,
    color: BRAND.muted,
    borderTopWidth: 0.5,
    borderTopColor: BRAND.ochre,
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export type WatermarkVariant = 'ORIGINAL' | 'DUPLICATE' | 'COPY' | null;
