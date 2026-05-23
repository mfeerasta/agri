import { StyleSheet } from '@react-pdf/renderer';

export const STMT_BRAND = {
  deepGreen: '#1B4332',
  ochre: '#D4A574',
  ink: '#1a1a1a',
  muted: '#555',
  border: '#999',
  softBg: '#F7F3EC',
};

export const stmtStyles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 40, paddingLeft: 40, paddingRight: 40, fontSize: 10, color: STMT_BRAND.ink, fontFamily: 'Helvetica' },
  header: { borderBottomWidth: 1.5, borderBottomColor: STMT_BRAND.ochre, paddingBottom: 6, marginBottom: 12 },
  brand: { color: STMT_BRAND.ochre, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  org: { color: STMT_BRAND.deepGreen, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  titleEn: { fontSize: 18, color: STMT_BRAND.deepGreen, fontFamily: 'Helvetica-Bold' },
  titleUr: { fontSize: 16, color: STMT_BRAND.deepGreen, fontFamily: 'Helvetica-Bold' },
  period: { fontSize: 10, color: STMT_BRAND.muted, marginBottom: 10 },
  sectionTitle: { fontSize: 12, color: STMT_BRAND.deepGreen, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowAlt: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, backgroundColor: STMT_BRAND.softBg },
  cellCode: { width: 50, fontSize: 9, color: STMT_BRAND.muted },
  cellLabel: { flex: 1, fontSize: 10 },
  cellAmount: { width: 110, fontSize: 10, textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.75, borderTopColor: STMT_BRAND.border, paddingTop: 4, paddingBottom: 4, marginTop: 4 },
  subtotalLabel: { flex: 1, fontSize: 11, fontFamily: 'Helvetica-Bold', color: STMT_BRAND.deepGreen },
  subtotalAmount: { width: 110, fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: STMT_BRAND.deepGreen },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: STMT_BRAND.deepGreen, paddingTop: 6, marginTop: 8, backgroundColor: STMT_BRAND.softBg, padding: 6 },
  totalLabel: { flex: 1, fontSize: 12, fontFamily: 'Helvetica-Bold', color: STMT_BRAND.deepGreen },
  totalAmount: { width: 110, fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: STMT_BRAND.deepGreen },
  footer: { position: 'absolute', bottom: 18, left: 40, right: 40, fontSize: 7, color: STMT_BRAND.muted, borderTopWidth: 0.5, borderTopColor: STMT_BRAND.ochre, paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
});

export function fmtPkr(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)}`;
}
